-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'canceled', 'past_due')),
  pages_used_this_month INTEGER DEFAULT 0,
  pages_limit INTEGER DEFAULT 5,
  billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversions table (one per uploaded PDF)
CREATE TABLE public.conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL, -- Supabase storage path
  page_count INTEGER,
  bank_detected TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  opening_balance DECIMAL(15,2),
  closing_balance DECIMAL(15,2),
  calculated_closing DECIMAL(15,2),
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciliation_difference DECIMAL(15,2),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (extracted data)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversion_id UUID NOT NULL REFERENCES public.conversions(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL, -- Order in the statement
  date DATE,
  description TEXT,
  debit DECIMAL(15,2),
  credit DECIMAL(15,2),
  balance DECIMAL(15,2),
  confidence_score DECIMAL(5,2) DEFAULT 100.00, -- 0-100
  is_excluded BOOLEAN DEFAULT FALSE, -- Ghost rows
  is_header BOOLEAN DEFAULT FALSE, -- Detected as header/footer
  pdf_page INTEGER, -- Which page this came from
  pdf_bbox JSONB, -- Bounding box coordinates {x1, y1, x2, y2}
  raw_text TEXT, -- Original extracted text
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversions_user_id ON public.conversions(user_id);
CREATE INDEX idx_conversions_status ON public.conversions(status);
CREATE INDEX idx_transactions_conversion_id ON public.transactions(conversion_id);
CREATE INDEX idx_transactions_row_index ON public.transactions(conversion_id, row_index);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own conversions" ON public.conversions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR ALL USING (
    conversion_id IN (
      SELECT id FROM public.conversions WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversions_updated_at
  BEFORE UPDATE ON public.conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
