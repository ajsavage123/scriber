-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Consultations Table
CREATE TABLE IF NOT EXISTS consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- DPDP Consent & De-Identification
    patient_synthetic_id VARCHAR(50) NOT NULL,
    patient_local_name VARCHAR(150),
    specialty VARCHAR(50) DEFAULT 'General Practice',
    
    -- Multilingual & Consent Audit Trail
    selected_language VARCHAR(10) DEFAULT 'multi',
    consent_obtained BOOLEAN DEFAULT FALSE,
    consent_language VARCHAR(10) DEFAULT 'en',
    consent_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- Audio & Transcription Records
    audio_storage_path TEXT,
    diarized_transcript JSONB,
    
    -- Dual Audit Clinical Notes
    raw_ai_soap_note JSONB,
    final_approved_soap_note JSONB,
    
    -- Workflow Status
    status VARCHAR(30) DEFAULT 'GENERATED', -- RECORDED, TRANSCRIBED, GENERATED, SIGNED, PURGED
    clinician_signed_at TIMESTAMP WITH TIME ZONE,
    clinician_notes TEXT
);

-- Row Level Security (RLS)
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated clinicians full access to their records"
ON consultations
FOR ALL
USING (auth.uid() = user_id OR auth.uid() IS NULL) -- Modified for open MVP sandbox testing
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);