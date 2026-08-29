export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
}

export interface SOAPNote {
  doctor_speaker_id: string;
  patient_speaker_id: string;
  speaker_roles?: Record<string, { role: string; confidence: number }>;
  needs_review?: boolean;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  chief_complaint: string;
  history_of_present_illness: string;
  allergies: string[];
  medications: Medication[];
  subjective: string;
  objective: string;
  assessment: string;
  plan: string[];
  follow_up: string;
  diarized_transcript?: string;
}

export interface Utterance {
  speaker: number;
  raw_speaker_id?: string;
  text: string;
  start: number;
  end: number;
  start_ms?: number;
  end_ms?: number;
}

export interface Consultation {
  id: string;
  created_at: string;
  patient_synthetic_id: string;
  patient_local_name?: string;
  specialty?: string;
  selected_language: string;
  consent_obtained: boolean;
  consent_language: string;
  consent_timestamp?: string;
  audio_storage_path?: string;
  diarized_transcript?: {
    formattedTranscript: string;
    utterances: Utterance[];
  };
  raw_ai_soap_note?: SOAPNote;
  final_approved_soap_note?: SOAPNote;
  status: 'RECORDED' | 'TRANSCRIBED' | 'GENERATED' | 'SIGNED' | 'PURGED';
  clinician_signed_at?: string;
  clinician_notes?: string;
  generation_error?: string;
}