-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crawl History Table
CREATE TABLE IF NOT EXISTS crawl_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    url TEXT NOT NULL,
    extraction_type TEXT NOT NULL DEFAULT 'llm',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    markdown TEXT,
    extracted_content TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY,
    theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('light', 'dark')),
    default_extraction_type TEXT NOT NULL DEFAULT 'llm',
    word_count_threshold INTEGER NOT NULL DEFAULT 50,
    max_concurrent_crawls INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Alias Search History Table
CREATE TABLE IF NOT EXISTS alias_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    username TEXT NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Image Search History Table
CREATE TABLE IF NOT EXISTS image_search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    matches_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crawl_history_user_id ON crawl_history(user_id);
CREATE INDEX IF NOT EXISTS idx_crawl_history_created_at ON crawl_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_history_status ON crawl_history(status);
CREATE INDEX IF NOT EXISTS idx_alias_search_user_id ON alias_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alias_search_created_at ON alias_search_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_search_user_id ON image_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_image_search_created_at ON image_search_history(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE crawl_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alias_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_search_history ENABLE ROW LEVEL SECURITY;

-- Crawl History Policies
CREATE POLICY "Users can view their own crawl history"
    ON crawl_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own crawl history"
    ON crawl_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own crawl history"
    ON crawl_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own crawl history"
    ON crawl_history FOR DELETE
    USING (auth.uid() = user_id);

-- User Settings Policies
CREATE POLICY "Users can view their own settings"
    ON user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON user_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- Alias Search History Policies
CREATE POLICY "Users can view their own alias search history"
    ON alias_search_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alias search history"
    ON alias_search_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alias search history"
    ON alias_search_history FOR DELETE
    USING (auth.uid() = user_id);

-- Image Search History Policies
CREATE POLICY "Users can view their own image search history"
    ON image_search_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own image search history"
    ON image_search_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own image search history"
    ON image_search_history FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
