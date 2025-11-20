# YouTube API Test Setup Guide

## YouTube Data API v3 Setup

### 1. Get API Key (Free Tier Available)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **YouTube Data API v3**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key
5. Set environment variable:
   ```bash
   export YOUTUBE_API_KEY=your_api_key_here
   ```

### 2. API Costs

**Free Tier:**
- **10,000 units per day** (free quota)
- Each video metadata request = **1 unit**
- **35 videos × 6 profiles = 210 requests** (well within free tier)

**Costs After Free Tier:**
- $0.00 per 1,000 additional requests (very cheap)
- For 210 requests: **$0.00** (completely free)

**Daily Limits:**
- Default: 10,000 units/day (free)
- Can request quota increase if needed (unlikely for testing)

**Summary:** This test will cost **$0.00** - completely free! ✅

### 3. Running the Test

1. **Add 35 YouTube URLs** to `test-classifier-urls.js`:
   ```javascript
   const videoUrls = [
     'https://www.youtube.com/watch?v=VIDEO_ID_1',
     'https://www.youtube.com/watch?v=VIDEO_ID_2',
     // ... 33 more URLs
   ];
   ```

2. **Set API key** (if using):
   ```bash
   export YOUTUBE_API_KEY=your_key_here
   ```

3. **Run the test**:
   ```bash
   cd server
   node test-classifier-urls.js
   ```

4. **Review results**:
   - Console output: Summary grouped by video
   - `test-results-urls.json`: Full detailed results for analysis

### 4. Without API Key (Fallback)

If you don't set `YOUTUBE_API_KEY`, the script will:
- Extract video IDs from URLs
- Use minimal metadata (title = "Video {id}", channel = "Unknown")
- Still run all classifications
- **Note:** Results will be less accurate without real titles/channels

### 5. Test Structure

- **35 videos** (long-form only, Shorts are auto-skipped)
- **6 user profiles** (different goal sets)
- **210 total classifications** (35 × 6)
- **Output:** JSON file with all results for 80-minute review

### 6. What to Look For

When reviewing `test-results-urls.json`:
1. **Consistency**: Same video should classify similarly across similar profiles
2. **Goal alignment**: Videos matching goals should be "productive"
3. **Edge cases**: Ambiguous videos that could go either way
4. **Confidence scores**: Low confidence = uncertain classifications
5. **Patterns**: Are certain categories always wrong? Are goals being ignored?

### 7. Next Steps After Review

Based on your 80-minute analysis:
- Identify common failure patterns
- Adjust prompt in `server/src/prompts/classifier.json`
- Re-run test to validate improvements
- Iterate until accuracy is acceptable

