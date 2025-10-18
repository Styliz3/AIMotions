// Cloudflare Pages Functions - CS2 Tracker Backend
// Save this file as: functions/api/track.js
// IMPORTANT: Add your Steam API key here: https://steamcommunity.com/dev/apikey
const STEAM_API_KEY = '9EA02C259FE915EA2A5DA393C387AC32';

// Ranking system tiers
const RANK_TIERS = [
  { name: 'Unranked', min: 0, max: 999 },
  { name: 'Silver', min: 1000, max: 1499 },
  { name: 'Gold Nova', min: 1500, max: 1999 },
  { name: 'Master Guardian', min: 2000, max: 2499 },
  { name: 'Legendary Eagle', min: 2500, max: 2999 },
  { name: 'Supreme', min: 3000, max: 3499 },
  { name: 'Global Elite', min: 3500, max: Infinity }
];

export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Check if API key is configured
    if (!STEAM_API_KEY || STEAM_API_KEY === 'YOUR_STEAM_API_KEY_HERE') {
      return jsonResponse({ 
        error: 'Steam API key not configured. Please add your Steam API key in functions/api/track.js. Get one at: https://steamcommunity.com/dev/apikey' 
      }, 500, corsHeaders);
    }

    const { steamInput } = await context.request.json();
    
    if (!steamInput) {
      return jsonResponse({ error: 'Steam input is required' }, 400, corsHeaders);
    }

    const steamId = await resolveSteamId(steamInput);
    
    if (!steamId) {
      return jsonResponse({ error: 'Invalid Steam profile URL or ID. Please check the URL and try again.' }, 400, corsHeaders);
    }

    // Fetch current stats
    const profile = await fetchSteamProfile(steamId);
    const stats = await fetchCS2Stats(steamId);
    
    // Calculate rank
    const rank = calculateRank(stats);
    
    // Get or create player history (using KV if available)
    let matches = [];
    if (context.env.CS2_TRACKER) {
      const history = await getPlayerHistory(context.env.CS2_TRACKER, steamId);
      matches = await trackNewMatches(context.env.CS2_TRACKER, steamId, stats, history);
    } else {
      // Generate sample matches if KV is not configured
      matches = generateSampleMatches(stats);
    }

    return jsonResponse({
      steamId,
      profile,
      stats,
      rank,
      matches
    }, 200, corsHeaders);

  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ error: error.message }, 500, corsHeaders);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

async function resolveSteamId(input) {
  try {
    // Direct Steam ID64
    if (/^\d{17}$/.test(input)) {
      return input;
    }

    // Extract from URL
    const patterns = [
      /steamcommunity\.com\/profiles\/(\d{17})/,
      /steamcommunity\.com\/id\/([^\/\?]+)/,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const identifier = match[1];
        
        // If it's already a Steam ID64, return it
        if (/^\d{17}$/.test(identifier)) {
          return identifier;
        }
        
        // Otherwise resolve vanity URL
        const vanityUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${identifier}`;
        const response = await fetch(vanityUrl);
        
        if (!response.ok) {
          throw new Error(`Steam API returned status ${response.status}`);
        }
        
        const text = await response.text();
        if (!text) {
          throw new Error('Empty response from Steam API');
        }
        
        const data = JSON.parse(text);
        
        if (data.response && data.response.success === 1) {
          return data.response.steamid;
        } else {
          throw new Error('Could not resolve Steam vanity URL. Make sure the profile exists and is public.');
        }
      }
    }

    throw new Error('Invalid Steam URL format. Use: https://steamcommunity.com/id/username or https://steamcommunity.com/profiles/STEAMID');
  } catch (error) {
    throw new Error(`Failed to resolve Steam ID: ${error.message}`);
  }
}

async function fetchSteamProfile(steamId) {
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Steam API returned status ${response.status}`);
    }
    
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response from Steam API');
    }
    
    const data = JSON.parse(text);

    if (!data.response || !data.response.players || !data.response.players.length) {
      throw new Error('Steam profile not found. Make sure the profile is public.');
    }

    return data.response.players[0];
  } catch (error) {
    throw new Error(`Failed to fetch Steam profile: ${error.message}`);
  }
}

async function fetchCS2Stats(steamId) {
  try {
    const CS2_APP_ID = '730';
    const url = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=${CS2_APP_ID}&key=${STEAM_API_KEY}&steamid=${steamId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Steam profile is private. Please make your profile and game details public in Steam settings.');
      }
      throw new Error(`Steam API returned status ${response.status}`);
    }
    
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response from Steam API');
    }
    
    const data = JSON.parse(text);

    if (!data.playerstats || !data.playerstats.stats) {
      throw new Error('CS2 stats not available. Make sure you have CS2 in your library and your game details are public.');
    }

    const stats = {};
    data.playerstats.stats.forEach(stat => {
      stats[stat.name] = stat.value;
    });

    // Calculate derived stats
    const totalKills = stats['total_kills'] || 0;
    const totalDeaths = Math.max(stats['total_deaths'] || 1, 1);
    const totalWins = stats['total_wins'] || 0;
    const totalRoundsPlayed = Math.max(stats['total_rounds_played'] || 1, 1);
    const totalShotsFired = Math.max(stats['total_shots_fired'] || 1, 1);
    const totalShotsHit = stats['total_shots_hit'] || 0;
    const totalKillsHeadshot = stats['total_kills_headshot'] || 0;
    const totalMVPs = stats['total_mvps'] || 0;
    const totalTimePlayed = stats['total_time_played'] || 0;

    return {
      total_kills: totalKills.toLocaleString(),
      total_deaths: totalDeaths.toLocaleString(),
      kd_ratio: (totalKills / totalDeaths).toFixed(2),
      total_wins: totalWins.toLocaleString(),
      win_rate: ((totalWins / totalRoundsPlayed) * 100).toFixed(1) + '%',
      headshot_percentage: totalKills > 0 ? ((totalKillsHeadshot / totalKills) * 100).toFixed(1) + '%' : '0%',
      accuracy: ((totalShotsHit / totalShotsFired) * 100).toFixed(1) + '%',
      mvps: totalMVPs.toLocaleString(),
      playtime: Math.round(totalTimePlayed / 3600),
      damage_per_round: stats['total_damage_done'] ? (stats['total_damage_done'] / totalRoundsPlayed).toFixed(0) : 'N/A',
      clutch_rate: 'N/A',
      first_kill_rate: 'N/A',
      
      // Raw stats for calculations
      raw: {
        kills: totalKills,
        deaths: totalDeaths,
        wins: totalWins,
        rounds: totalRoundsPlayed,
        headshots: totalKillsHeadshot,
        mvps: totalMVPs,
        playtime: totalTimePlayed
      }
    };

  } catch (error) {
    if (error.message.includes('private') || error.message.includes('public')) {
      throw error;
    }
    throw new Error(`Failed to fetch CS2 stats: ${error.message}`);
  }
}

function calculateRank(stats) {
  const raw = stats.raw;
  
  // Custom ranking algorithm (similar to Leetify's approach)
  let rating = 1000; // Base rating
  
  // K/D Ratio impact (0-800 points)
  const kd = raw.kills / Math.max(raw.deaths, 1);
  rating += Math.min(kd * 200, 800);
  
  // Win Rate impact (0-600 points)
  const winRate = raw.wins / Math.max(raw.rounds, 1);
  rating += Math.min(winRate * 600, 600);
  
  // Headshot percentage impact (0-400 points)
  const hsRate = raw.headshots / Math.max(raw.kills, 1);
  rating += Math.min(hsRate * 400, 400);
  
  // MVPs impact (0-300 points)
  const mvpRate = raw.mvps / Math.max(raw.rounds, 1);
  rating += Math.min(mvpRate * 300, 300);
  
  // Playtime bonus (experience factor, 0-200 points)
  const hours = raw.playtime / 3600;
  rating += Math.min(Math.log10(hours + 1) * 100, 200);
  
  // Round to integer
  rating = Math.round(rating);
  
  // Determine tier
  const tier = RANK_TIERS.find(t => rating >= t.min && rating <= t.max);
  
  return {
    rating,
    tier: tier ? tier.name : 'Unranked',
    breakdown: {
      kd_contribution: Math.min(kd * 200, 800),
      winrate_contribution: Math.min(winRate * 600, 600),
      accuracy_contribution: Math.min(hsRate * 400, 400),
      mvp_contribution: Math.min(mvpRate * 300, 300),
      experience_contribution: Math.min(Math.log10(hours + 1) * 100, 200)
    }
  };
}

async function getPlayerHistory(kv, steamId) {
  try {
    const history = await kv.get(`player:${steamId}`, 'json');
    return history || { lastUpdate: 0, stats: null, matches: [] };
  } catch (error) {
    console.error('Failed to get player history:', error);
    return { lastUpdate: 0, stats: null, matches: [] };
  }
}

async function trackNewMatches(kv, steamId, currentStats, history) {
  const now = Date.now();
  const matches = history.matches || [];
  
  // If we have previous stats, compare to detect new matches
  if (history.stats && history.stats.raw) {
    const prevRaw = history.stats.raw;
    const currRaw = currentStats.raw;
    
    // Detect if there's a difference in stats (new match played)
    if (currRaw.kills !== prevRaw.kills || currRaw.deaths !== prevRaw.deaths) {
      const killsDiff = currRaw.kills - prevRaw.kills;
      const deathsDiff = currRaw.deaths - prevRaw.deaths;
      const winsDiff = currRaw.wins - prevRaw.wins;
      
      // Only add if meaningful difference (played at least 1 round)
      if (killsDiff > 0 || deathsDiff > 0) {
        const newMatch = {
          date: new Date().toLocaleDateString(),
          map: 'Competitive Match', // Can't determine map from API
          kills: killsDiff,
          deaths: deathsDiff,
          score: `${Math.round(killsDiff * 2.5)}-${Math.round(deathsDiff * 2)}`,
          result: winsDiff > 0 ? 'win' : 'loss',
          mvps: Math.max(0, (currRaw.mvps || 0) - (prevRaw.mvps || 0)),
          headshot_percentage: killsDiff > 0 ? 
            (((currRaw.headshots - prevRaw.headshots) / killsDiff) * 100).toFixed(0) + '%' : '0%'
        };
        
        matches.unshift(newMatch);
        
        // Keep only last 10 matches
        if (matches.length > 10) {
          matches.length = 10;
        }
      }
    }
  }
  
  // Save updated history
  try {
    await kv.put(`player:${steamId}`, JSON.stringify({
      lastUpdate: now,
      stats: currentStats,
      matches
    }));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
  
  return matches;
}

function generateSampleMatches(stats) {
  // Generate sample match history based on stats
  const matches = [];
  const numMatches = 5;
  
  const avgKills = Math.round(stats.raw.kills / Math.max(stats.raw.rounds / 30, 1));
  const avgDeaths = Math.round(stats.raw.deaths / Math.max(stats.raw.rounds / 30, 1));
  const winRate = stats.raw.wins / Math.max(stats.raw.rounds, 1);
  
  const maps = ['Mirage', 'Dust II', 'Inferno', 'Nuke', 'Overpass', 'Ancient', 'Anubis'];
  
  for (let i = 0; i < numMatches; i++) {
    const kills = Math.max(0, avgKills + Math.floor(Math.random() * 10 - 5));
    const deaths = Math.max(1, avgDeaths + Math.floor(Math.random() * 8 - 4));
    const isWin = Math.random() < winRate;
    
    matches.push({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString(),
      map: maps[Math.floor(Math.random() * maps.length)],
      kills,
      deaths,
      score: `${16 + Math.floor(Math.random() * 3)}-${13 + Math.floor(Math.random() * 3)}`,
      result: isWin ? 'win' : 'loss',
      mvps: Math.floor(Math.random() * 4),
      headshot_percentage: (30 + Math.random() * 30).toFixed(0) + '%'
    });
  }
  
  return matches;
}
