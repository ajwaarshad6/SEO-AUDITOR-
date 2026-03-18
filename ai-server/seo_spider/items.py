import scrapy

class SeoPageItem(scrapy.Item):
    # --- Identity ---
    url = scrapy.Field()
    status = scrapy.Field()
    # --- ADVANCED SEMRUSH RULES FIELDS ---
    has_noindex = scrapy.Field()
    missing_viewport = scrapy.Field()
    missing_hreflang = scrapy.Field()
    headings_hierarchy = scrapy.Field()
    from_sitemap = scrapy.Field()
    
    # --- Content & Meta ---
    title = scrapy.Field()
    meta_desc = scrapy.Field()
    h1_count = scrapy.Field()
    canonical = scrapy.Field()
    og_url = scrapy.Field()
    
    # --- New Fields for Strict Audit ---
    readability_score = scrapy.Field()      # 0-100 Score
    serp_title = scrapy.Field()             # Title scraped from Google
    serp_match = scrapy.Field()             # Boolean
    is_orphan = scrapy.Field()              # Boolean (Calculated at end)
    is_duplicate_title = scrapy.Field()     # Boolean (Calculated at end)
    is_duplicate_desc = scrapy.Field()      # Boolean (Calculated at end)
    
    # --- Metrics ---
    mobile = scrapy.Field()         
    audit_score = scrapy.Field()    
    health_label = scrapy.Field()   
    audit_issues = scrapy.Field() 
    # ADD THIS NEW LINE RIGHT HERE:
    mobile_pagespeed = scrapy.Field()  
    
    # --- Links ---
    links_internal = scrapy.Field()         # List of internal links on this page
    links_external = scrapy.Field()         # List of external links on this page
    broken_external_links = scrapy.Field()  # List of 404 external links
    
    # --- Redirects ---
    redirect_chain = scrapy.Field()
    redirect_count = scrapy.Field()
    
    # --- Schema/Social ---
    schema_types = scrapy.Field()
    has_social_links = scrapy.Field()