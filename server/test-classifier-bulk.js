// Bulk test script for AI classifier
// Run: node test-classifier-bulk.js

const SERVER_URL = process.env.SERVER_URL || 'https://focustube-backend-4xah.onrender.com';
const TEST_EMAIL = 'test-bulk@example.com';

// Test cases: [title, goals, expected_level, expected_category_hint]
const testCases = [
  // Productive videos
  ['React useEffect Explained with Examples', ['learn React', 'ship MVP'], 'productive', 'programming'],
  ['Python Basics for Beginners', ['learn Python'], 'productive', 'programming'],
  ['How to Build a Startup', ['build startup', 'learn business'], 'productive', 'business'],
  ['Fitness Training Guide', ['get fit', 'health'], 'productive', 'fitness'],
  ['Data Science Tutorial', ['learn data science'], 'productive', 'data'],
  
  // Distracting videos
  ['Wild Celebrity Moments #47', ['learn React'], 'distracting', 'entertainment'],
  ['Funny Memes Compilation 2025', ['build startup'], 'distracting', 'entertainment'],
  ['Gaming Highlights - Epic Fails', ['learn Python'], 'distracting', 'gaming'],
  ['Celebrity Gossip Roundup', ['get fit'], 'distracting', 'entertainment'],
  ['Viral TikTok Compilation', ['learn business'], 'distracting', 'entertainment'],
  
  // Neutral videos (edge cases)
  ['I Tried The Best Rated Burgers!', ['learn cooking'], 'neutral', 'food'],
  ['News Update: Tech Industry', ['learn React'], 'neutral', 'news'],
  ['Product Review: New Laptop', ['build startup'], 'neutral', 'review'],
  
  // Shorts (should default to distracting unless educational)
  ['Quick React Tip #shorts', ['learn React'], 'productive', 'programming'],
  ['Funny Cat Video #shorts', ['learn Python'], 'distracting', 'entertainment'],
  
  // Goal-aligned vs misaligned
  ['Business Strategy Explained', ['learn business', 'build startup'], 'productive', 'business'],
  ['Business Strategy Explained', ['learn React', 'get fit'], 'neutral', 'business'],
  ['Celebrity Interview', ['learn business'], 'distracting', 'entertainment'],
  ['Celebrity Interview', ['entertainment', 'celebrity news'], 'neutral', 'entertainment'],
];

// Generate 100 test cases by repeating and varying
function generateTestCases() {
  const cases = [];
  const baseCases = [...testCases];
  
  // Repeat base cases with variations
  for (let i = 0; i < 100; i++) {
    const base = baseCases[i % baseCases.length];
    const variation = {
      title: `${base[0]} (Test ${i + 1})`,
      goals: base[1],
      expected: base[2],
      categoryHint: base[3],
      video_id: `test-video-${i}`,
      channel: `Test Channel ${Math.floor(i / 10)}`,
      is_shorts: i % 5 === 0, // Every 5th is a Short
    };
    cases.push(variation);
  }
  
  return cases;
}

async function testClassification(testCase) {
  try {
    const response = await fetch(`${SERVER_URL}/ai/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: TEST_EMAIL,
        video_title: testCase.title,
        video_id: testCase.video_id,
        channel_name: testCase.channel,
        is_shorts: testCase.is_shorts,
        user_goals: testCase.goals,
        context: 'WATCH',
      }),
    });
    
    const result = await response.json();
    return {
      ...testCase,
      actual: result.distraction_level,
      category: result.category_primary || result.category,
      confidence: result.confidence_distraction || result.confidence,
      correct: result.distraction_level === testCase.expected,
      reasons: result.reasons || [],
    };
  } catch (error) {
    return {
      ...testCase,
      error: error.message,
      correct: false,
    };
  }
}

async function runBulkTest() {
  console.log('🚀 Starting bulk classifier test...\n');
  const testCases = generateTestCases();
  const results = [];
  
  console.log(`Testing ${testCases.length} cases...\n`);
  
  // Run tests with small delay to avoid rate limits
  for (let i = 0; i < testCases.length; i++) {
    const result = await testClassification(testCases[i]);
    results.push(result);
    
    if ((i + 1) % 10 === 0) {
      console.log(`Progress: ${i + 1}/${testCases.length} (${Math.round((i + 1) / testCases.length * 100)}%)`);
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Analyze results
  const correct = results.filter(r => r.correct).length;
  const accuracy = (correct / results.length) * 100;
  
  const byLevel = {
    productive: { expected: 0, correct: 0 },
    neutral: { expected: 0, correct: 0 },
    distracting: { expected: 0, correct: 0 },
  };
  
  results.forEach(r => {
    if (r.expected) byLevel[r.expected].expected++;
    if (r.correct && r.actual && byLevel[r.actual]) {
      byLevel[r.actual].correct++;
    }
  });
  
  console.log('\n📊 Results:');
  console.log(`Total: ${results.length}`);
  console.log(`Correct: ${correct}`);
  console.log(`Accuracy: ${accuracy.toFixed(1)}%\n`);
  
  console.log('By Category:');
  Object.entries(byLevel).forEach(([level, stats]) => {
    const acc = stats.expected > 0 ? (stats.correct / stats.expected * 100).toFixed(1) : 'N/A';
    console.log(`  ${level}: ${stats.correct}/${stats.expected} (${acc}%)`);
  });
  
  // Show failures
  const failures = results.filter(r => !r.correct && !r.error);
  if (failures.length > 0) {
    console.log(`\n❌ Failures (${failures.length}):`);
    failures.slice(0, 10).forEach(f => {
      console.log(`  "${f.title.substring(0, 40)}..." → Expected: ${f.expected}, Got: ${f.actual}`);
    });
    if (failures.length > 10) {
      console.log(`  ... and ${failures.length - 10} more`);
    }
  }
  
  // Show errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n⚠️ Errors (${errors.length}):`);
    errors.slice(0, 5).forEach(e => {
      console.log(`  "${e.title.substring(0, 40)}..." → ${e.error}`);
    });
  }
  
  console.log('\n✅ Test complete!');
}

// Run if called directly
if (require.main === module) {
  runBulkTest().catch(console.error);
}

module.exports = { runBulkTest, generateTestCases };