-- 1. Keywords Table
CREATE TABLE keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(keyword_text, language)
);

-- 2. Keyword Metrics
CREATE TABLE keyword_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    country_code VARCHAR(5) NOT NULL,
    search_volume INT NOT NULL DEFAULT 0,
    cpc DECIMAL(10, 2) DEFAULT 0.00,
    competition_density DECIMAL(3, 2) DEFAULT 0.00,
    results_count BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(keyword_id, country_code)
);

-- 3. Keyword Trends
CREATE TABLE keyword_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    country_code VARCHAR(5) NOT NULL,
    month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INT NOT NULL,
    search_volume INT NOT NULL
);

-- 4. SERP Results
CREATE TABLE serp_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    country_code VARCHAR(5) NOT NULL,
    position INT NOT NULL CHECK (position BETWEEN 1 AND 100),
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    page_type VARCHAR(50),
    referring_domains INT DEFAULT 0,
    domain_authority INT DEFAULT 0,
    estimated_traffic_share DECIMAL(5, 2) DEFAULT 0.00
);

-- 5. SERP Features
CREATE TABLE serp_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL 
);

-- 6. Keyword Intent
CREATE TABLE keyword_intent (
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE PRIMARY KEY,
    primary_intent VARCHAR(20) NOT NULL,
    secondary_intents TEXT[] DEFAULT '{}',
    confidence_score DECIMAL(3, 2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1)
);

-- 7. Keyword Clusters
CREATE TABLE keyword_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_keyword_id UUID REFERENCES keywords(id),
    cluster_name TEXT NOT NULL
);

-- 8. Cluster Map
CREATE TABLE keyword_cluster_map (
    cluster_id UUID REFERENCES keyword_clusters(id) ON DELETE CASCADE,
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    serp_overlap_percentage DECIMAL(5, 2) NOT NULL,
    PRIMARY KEY (cluster_id, keyword_id)
);

-- 9. Competitors
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    overlap_percentage DECIMAL(5, 2),
    average_position DECIMAL(4, 1),
    visibility_score DECIMAL(5, 2)
);

-- 10. Keyword Difficulty
CREATE TABLE keyword_difficulty (
    keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE PRIMARY KEY,
    kd_score DECIMAL(5, 2) NOT NULL CHECK (kd_score BETWEEN 0 AND 100),
    difficulty_label VARCHAR(20) NOT NULL
);

-- INDEXES for Filtering Performance
CREATE INDEX idx_keywords_text ON keywords(keyword_text);
CREATE INDEX idx_metrics_volume ON keyword_metrics(search_volume);
CREATE INDEX idx_metrics_cpc ON keyword_metrics(cpc);
CREATE INDEX idx_kd_score ON keyword_difficulty(kd_score);
CREATE INDEX idx_intent_primary ON keyword_intent(primary_intent);