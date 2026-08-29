import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// Simple in-memory cache to protect rate-limited Deepgram Management APIs
let cachedUsage: any = null;
let lastFetched = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds cache

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";
    const now = Date.now();

    if (cachedUsage && (now - lastFetched < CACHE_TTL) && !forceRefresh) {
      return NextResponse.json(cachedUsage);
    }
    let deepgramStats = {
      status: "inactive",
      balance: 0.00,
      totalRequests: 0,
      totalHours: 0,
      message: "No API Key configured"
    };

    let cloudflareStats: {
      status: string;
      totalRuns: number;
      estimatedTokens: number;
      estimatedNeurons?: number;
      isEstimated?: boolean;
    } = {
      status: "inactive",
      totalRuns: 0,
      estimatedTokens: 0,
      estimatedNeurons: 0,
      isEstimated: true
    };

    let dbStats = {
      status: "disconnected",
      totalConsultations: 0,
      completedNotes: 0
    };

    // 1. Fetch DB Stats (Supabase)
    try {
      const { data, count, error } = await supabaseServer
        .from("consultations")
        .select("id, raw_ai_soap_note, diarized_transcript", { count: "exact" });

      if (error) {
        console.error("[Usage API] Supabase error:", error);
        dbStats.status = "error";
      } else {
        dbStats.status = "connected";
        dbStats.totalConsultations = count || 0;
        
        let completed = 0;
        let withTranscripts = 0;
        let estimatedLlamaTokens = 0;

        if (data) {
          data.forEach(item => {
            if (item.raw_ai_soap_note) {
              completed++;
              // Estimate Llama 3.3 tokens (approx 1000 input + 800 output tokens per run average)
              estimatedLlamaTokens += 1800;
            }
            if (item.diarized_transcript) {
              withTranscripts++;
            }
          });
        }
        dbStats.completedNotes = completed;

        // Cloudflare stats based on completed SOAP generations (Llama 3.3 runs)
        // Neuron rate: ~0.0267 neurons/input token + ~0.2048 neurons/output token ≈ 255 neurons per 5-min run
        const estimatedNeurons = Math.round(completed * 255);
        cloudflareStats = {
          status: process.env.CLOUDFLARE_API_TOKEN ? "operational" : "inactive",
          totalRuns: completed,
          estimatedTokens: estimatedLlamaTokens,
          estimatedNeurons: estimatedNeurons,
          isEstimated: true
        };
      }
    } catch (dbErr: any) {
      console.error("[Usage API] DB access exception:", dbErr);
      dbStats.status = "error";
    }

    // 2. Fetch Deepgram stats
    const dgKey = process.env.DEEPGRAM_API_KEY;
    if (dgKey) {
      try {
        // Fetch projects first
        const projectsRes = await fetch("https://api.deepgram.com/v1/projects", {
          headers: {
            Authorization: `Token ${dgKey}`
          }
        });

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          const activeProject = projectsData.projects?.[0];

          if (activeProject) {
            const projectId = activeProject.project_id;
            deepgramStats.status = "operational";
            deepgramStats.message = "Successfully connected";

            // Fetch Balances
            const balancesRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/balances`, {
              headers: {
                Authorization: `Token ${dgKey}`
              }
            });

            if (balancesRes.ok) {
              const balancesData = await balancesRes.json();
              // Sum up balances (some might be promotional credits, others cash)
              let totalBal = 0;
              if (balancesData.balances && Array.isArray(balancesData.balances)) {
                balancesData.balances.forEach((bal: any) => {
                  totalBal += parseFloat(bal.amount || 0);
                });
              }
              deepgramStats.balance = totalBal;
            }

            // Fetch Usage Summary (last 30 days)
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            const start = thirtyDaysAgo.toISOString().split("T")[0];
            const end = now.toISOString().split("T")[0];

            const usageRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/usage/summary?start=${start}&end=${end}`, {
              headers: {
                Authorization: `Token ${dgKey}`
              }
            });

            if (usageRes.ok) {
              const usageData = await usageRes.json();
              deepgramStats.totalRequests = usageData.requests || 0;
              deepgramStats.totalHours = parseFloat((usageData.hours || 0).toFixed(2));
            } else {
              // Fallback to local DB counts if usage summary API fails
              deepgramStats.totalRequests = dbStats.totalConsultations;
              deepgramStats.totalHours = parseFloat((dbStats.totalConsultations * 0.05).toFixed(2)); // Estimate 3 mins per call
            }
          } else {
            deepgramStats.status = "error";
            deepgramStats.message = "No active project found in Deepgram console";
          }
        } else {
          deepgramStats.status = "error";
          deepgramStats.message = `Deepgram project list returned ${projectsRes.status}`;
        }
      } catch (dgErr: any) {
        console.error("[Usage API] Deepgram fetch exception:", dgErr);
        deepgramStats.status = "error";
        deepgramStats.message = dgErr.message || "Failed to reach Deepgram API";
      }
    }

    const result = {
      deepgram: deepgramStats,
      cloudflare: cloudflareStats,
      database: dbStats
    };

    // Cache successful results to prevent hitting rate limits
    if (deepgramStats.status !== "error" && dbStats.status === "connected") {
      cachedUsage = result;
      lastFetched = now;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
