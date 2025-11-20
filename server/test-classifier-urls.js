// Test classifier with real YouTube URLs
// Run: node test-classifier-urls.js
// Usage: Paste 35 YouTube URLs in the `videoUrls` array below
// Tests each video against 6 different user profiles (goal sets)

const SERVER_URL = process.env.SERVER_URL || 'https://focustube-backend-4xah.onrender.com';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || ''; // Optional: for full metadata

// Paste your 35 YouTube URLs here (long-form videos only)
const videoUrls = [
  'https://www.youtube.com/watch?v=MAZRqzcZRKo',
  'https://www.youtube.com/watch?v=eBq5QcCfXYQ',
  'https://www.youtube.com/watch?v=n4JcdCKmKL0',
  'https://www.youtube.com/watch?v=bTsMbUi6pyI',
  'https://www.youtube.com/watch?v=E1ZVSFfCk9g',
  
  'https://www.youtube.com/watch?v=rfscVS0vtbw',
  'https://www.youtube.com/watch?v=qkFYqY3vr84',
  'https://www.youtube.com/watch?v=i_36dg1t0e4',
  'https://www.youtube.com/watch?v=I78h9HrSndE',
  'https://www.youtube.com/watch?v=OsN_MJopMxc',
  
  'https://www.youtube.com/watch?v=GiaNp0u_swU',
  'https://www.youtube.com/watch?v=VQ5BQu4ANMU',
  'https://www.youtube.com/watch?v=xWHOsHQ0BnQ',
  'https://www.youtube.com/watch?v=Gqi5VZxS7CE',
  'https://www.youtube.com/watch?v=bhQnooudZcs',
  
  'https://www.youtube.com/watch?v=y8cE5skIvok',
  'https://www.youtube.com/watch?v=fZDvnHdBqFw',
  'https://www.youtube.com/watch?v=M2khW5YZdH8',
  'https://www.youtube.com/watch?v=M4K0s792wAU',
  'https://www.youtube.com/watch?v=g9QGQJ1ypp0',
  
  'https://www.youtube.com/watch?v=ifFF2-0EPxM',
  'https://www.youtube.com/watch?v=RDYA7MFv5xw',
  'https://www.youtube.com/watch?v=Jwu8f42rLuI',
  'https://www.youtube.com/watch?v=WQneOolYFbo',
  'https://www.youtube.com/watch?v=NwX2dh0dwNA',
  
  'https://www.youtube.com/watch?v=QB8i9WiTIzw',
  'https://www.youtube.com/watch?v=8nci43AtZBI',
  'https://www.youtube.com/watch?v=xqinMU1rCXE',
  'https://www.youtube.com/watch?v=pVVZq5FRr3o',
  'https://www.youtube.com/watch?v=N7RXaItP7aI',
  'https://www.youtube.com/watch?v=vGjgAUqmqws',
  'https://www.youtube.com/watch?v=YEGGNAk7QZM',
  'https://www.youtube.com/watch?v=jSOU-J9KHbg',
  'https://www.youtube.com/watch?v=YHhAsSoP04c',
  'https://www.youtube.com/watch?v=lQKuc5mxdQM',
  
  'https://www.youtube.com/watch?v=nq9Vij_S10c',
  'https://www.youtube.com/watch?v=xsVTqzratPs&t=85s',
  'https://www.youtube.com/watch?v=39o0uYPo4jU',
  'https://www.youtube.com/watch?v=p0qkQOJjR7c',
  'https://www.youtube.com/watch?v=5sCGZAcXKWg',
  
];

// 6 User profiles (goal sets) to test against each video
const userProfiles = [
  {
    name: 'Disciplined Student',
    email: 'test-student1@example.com',
    goals: ['study with focus', 'learn course material', 'cook basic meals', 'stay informed'],
    anti_goals: ['vlogs', 'gaming content', 'endless study-with-me loops'],
  },
  {
    name: 'Upskilling Engineer',
    email: 'test-engineer@example.com',
    goals: ['learn backend concepts', 'follow tooling updates', 'practice music production'],
    anti_goals: ['tech drama', 'clickbait comparisons', 'gear review spirals'],
  },
  {
    name: 'Focused Gym-Goer',
    email: 'test-fitness2@example.com',
    goals: ['strength training', 'nutrition basics', 'injury prevention', 'mobility work'],
    anti_goals: ['bro-science', 'supplement hype', 'prank content'],
  },
  {
    name: 'Pragmatic Business Owner',
    email: 'test-business2@example.com',
    goals: ['learn marketing', 'improve design skills', 'edit videos', 'track industry trends'],
    anti_goals: ['motivation gurus', 'passive income hacks', 'productivity-porn'],
  },
  {
    name: 'Overloaded New Parent',
    email: 'test-parent@example.com',
    goals: ['infant care', 'household organization', 'calming entertainment'],
    anti_goals: ['dramatic parenting advice', 'sensationalized news', 'reaction binges'],
  },
  {
    name: 'Digital Nomad Planner',
    email: 'test-nomad@example.com',
    goals: ['visa logistics', 'language learning', 'remote work improvement'],
    anti_goals: ['escapist travel vlogs', 'gear-review loops', 'country drama channels'],
  },
];

// Extract video ID from URL
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch video metadata from YouTube Data API
async function fetchVideoMetadata(videoId) {
  if (!YOUTUBE_API_KEY) {
    console.warn(`⚠️  No YOUTUBE_API_KEY - using minimal metadata for ${videoId}`);
    return {
      video_id: videoId,
      video_title: `Video ${videoId}`,
      channel_name: 'Unknown Channel',
      video_description: '',
      video_tags: [],
      duration_seconds: null,
      video_category: null,
      is_shorts: false,
    };
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`
    );
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const item = data.items[0];
    const snippet = item.snippet;
    const contentDetails = item.contentDetails;
    
    // Parse duration (PT4M13S -> 253 seconds)
    let durationSeconds = null;
    if (contentDetails?.duration) {
      const match = contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (match) {
        const hours = parseInt(match[1] || 0);
        const minutes = parseInt(match[2] || 0);
        const seconds = parseInt(match[3] || 0);
        durationSeconds = hours * 3600 + minutes * 60 + seconds;
      }
    }

    // Detect Shorts (duration <= 60 seconds) - filter these out
    const isShorts = durationSeconds !== null && durationSeconds <= 60;

    return {
      video_id: videoId,
      video_title: snippet.title || 'Untitled',
      channel_name: snippet.channelTitle || 'Unknown Channel',
      video_description: snippet.description || '',
      video_tags: snippet.tags || [],
      duration_seconds: durationSeconds,
      video_category: snippet.categoryId || null,
      is_shorts: isShorts,
    };
  } catch (error) {
    console.error(`❌ Error fetching metadata for ${videoId}:`, error.message);
    return {
      video_id: videoId,
      video_title: `Error: ${error.message}`,
      channel_name: 'Unknown',
      video_description: '',
      video_tags: [],
      duration_seconds: null,
      video_category: null,
      is_shorts: false,
    };
  }
}

// Test classification
async function testClassification(metadata, userProfile) {
  try {
    const response = await fetch(`${SERVER_URL}/ai/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userProfile.email,
        video_title: metadata.video_title,
        video_id: metadata.video_id,
        channel_name: metadata.channel_name,
        video_description: metadata.video_description,
        video_tags: metadata.video_tags,
        is_shorts: metadata.is_shorts,
        duration_seconds: metadata.duration_seconds,
        user_goals: userProfile.goals,
        context: 'WATCH',
      }),
    });
    
    const result = await response.json();
    return {
      classification: result.distraction_level || result.category || 'neutral',
      category: result.category_primary || result.category || 'unknown',
      confidence: result.confidence_distraction || result.confidence || 0.5,
      reasons: Array.isArray(result.reasons) ? result.reasons : [result.reason || 'N/A'],
    };
  } catch (error) {
    return {
      error: error.message,
      classification: 'error',
    };
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting URL-based classifier test...\n');
  console.log(`Testing ${videoUrls.length} videos with ${userProfiles.length} user profiles each`);
  console.log(`Total tests: ${videoUrls.length * userProfiles.length}\n`);
  
  if (videoUrls.length === 0) {
    console.error('❌ No video URLs provided! Add 35 URLs to the videoUrls array.');
    process.exit(1);
  }
  
  const results = [];
  let skippedShorts = 0;
  
  for (let i = 0; i < videoUrls.length; i++) {
    const url = videoUrls[i];
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      console.warn(`⚠️  Skipping invalid URL: ${url}`);
      continue;
    }
    
    console.log(`\n[${i + 1}/${videoUrls.length}] Fetching metadata for ${videoId}...`);
    const metadata = await fetchVideoMetadata(videoId);
    
    // Skip Shorts (long-form only)
    if (metadata.is_shorts) {
      console.log(`  ⏭️  Skipping Short (${metadata.duration_seconds}s): ${metadata.video_title.substring(0, 60)}...`);
      skippedShorts++;
      continue;
    }
    
    console.log(`  📹 ${metadata.video_title.substring(0, 60)}...`);
    console.log(`  📺 Channel: ${metadata.channel_name}`);
    console.log(`  ⏱️  Duration: ${metadata.duration_seconds ? Math.floor(metadata.duration_seconds / 60) + 'm' : 'unknown'}`);
    
    // Test with each user profile
    for (const profile of userProfiles) {
      console.log(`  🧪 Testing with: ${profile.name} (${profile.goals.slice(0, 2).join(', ')}...)`);
      
      const classification = await testClassification(metadata, profile);
      
      results.push({
        url,
        video_id: videoId,
        title: metadata.video_title,
        channel: metadata.channel_name,
        duration_seconds: metadata.duration_seconds,
        user_profile: profile.name,
        user_email: profile.email,
        goals: profile.goals,
        anti_goals: profile.anti_goals,
        classification: classification.classification,
        category: classification.category,
        confidence: classification.confidence,
        reasons: classification.reasons,
        error: classification.error,
      });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Delay between videos
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Output results
  console.log('\n\n📊 RESULTS SUMMARY\n');
  console.log('='.repeat(80));
  console.log(`Total videos tested: ${results.length / userProfiles.length}`);
  console.log(`Shorts skipped: ${skippedShorts}`);
  console.log(`Total classifications: ${results.length}\n`);
  
  // Group by video
  const byVideo = {};
  results.forEach(r => {
    if (!byVideo[r.video_id]) {
      byVideo[r.video_id] = {
        title: r.title,
        channel: r.channel,
        duration: r.duration_seconds,
        tests: [],
      };
    }
    byVideo[r.video_id].tests.push({
      user_profile: r.user_profile,
      classification: r.classification,
      confidence: r.confidence,
    });
  });
  
  Object.entries(byVideo).forEach(([videoId, data]) => {
    console.log(`\n📹 ${data.title.substring(0, 60)}`);
    console.log(`   Channel: ${data.channel} | Duration: ${data.duration ? Math.floor(data.duration / 60) + 'm' : 'unknown'}`);
    console.log(`   URL: https://youtube.com/watch?v=${videoId}`);
    data.tests.forEach(test => {
      const confPercent = (test.confidence * 100).toFixed(0);
      console.log(`   • ${test.user_profile}: ${test.classification} (${confPercent}%)`);
    });
  });
  
  // Classification distribution
  console.log('\n\n📈 CLASSIFICATION DISTRIBUTION\n');
  const distribution = {};
  results.forEach(r => {
    if (!distribution[r.classification]) {
      distribution[r.classification] = 0;
    }
    distribution[r.classification]++;
  });
  Object.entries(distribution).forEach(([level, count]) => {
    const percent = ((count / results.length) * 100).toFixed(1);
    console.log(`   ${level}: ${count} (${percent}%)`);
  });
  
  // Save to JSON file for detailed review
  const fs = require('fs');
  const outputFile = 'test-results-urls.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n\n✅ Detailed results saved to ${outputFile}`);
  console.log(`   Total tests: ${results.length}`);
  console.log(`   Videos tested: ${Object.keys(byVideo).length}`);
  console.log(`   Review the JSON file to analyze patterns and failures.`);
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, extractVideoId, fetchVideoMetadata };

