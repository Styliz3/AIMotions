// Cloudflare Worker for CS2 Tracking Site
// Add your Steam API key here: https://steamcommunity.com/dev/apikey
const STEAM_API_KEY = '9EA02C259FE915EA2A5DA393C387AC32';

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CS2 Stats Tracker</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            padding: 40px 0;
        }
        .header h1 {
            font-size: 3em;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #f39c12, #e74c3c);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .search-box {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        input {
            flex: 1;
            padding: 15px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-size: 16px;
            transition: all 0.3s;
        }
        input:focus {
            outline: none;
            border-color: #f39c12;
            background: rgba(255, 255, 255, 0.1);
        }
        input::placeholder { color: rgba(255, 255, 255, 0.5); }
        button {
            padding: 15px 40px;
            background: linear-gradient(90deg, #f39c12, #e74c3c);
            border: none;
            border-radius: 10px;
            color: #fff;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        button:hover { transform: translateY(-2px); }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .error {
            background: rgba(231, 76, 60, 0.2);
            border: 1px solid #e74c3c;
            padding: 15px;
            border-radius: 10px;
            margin-top: 15px;
        }
        .loading {
            text-align: center;
            padding: 40px;
            font-size: 18px;
        }
        .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 30px;
        }
        .stat-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-card h3 {
            color: #f39c12;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-item:last-child { border-bottom: none; }
        .stat-label { color: rgba(255, 255, 255, 0.7); }
        .stat-value {
            font-weight: 600;
            color: #fff;
        }
        .profile-header {
            display: flex;
            align-items: center;
            gap: 20px;
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .profile-avatar {
            width: 100px;
            height: 100px;
            border-radius: 15px;
            border: 3px solid #f39c12;
        }
        .profile-info h2 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        .profile-link {
            color: #f39c12;
            text-decoration: none;
        }
        .profile-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 CS2 Stats Tracker</h1>
            <p>Track your Counter-Strike 2 performance</p>
        </div>

        <div class="search-box">
            <div class="input-group">
                <input type="text" id="steamInput" placeholder="Enter Steam Profile URL or Steam ID (e.g., https://steamcommunity.com/id/username)">
                <button onclick="fetchStats()">Track Stats</button>
            </div>
            <div id="error" style="display: none;" class="error"></div>
        </div>

        <div id="loading" style="display: none;" class="loading">
            Loading stats...
        </div>

        <div id="results"></div>
    </div>

    <script>
        async function fetchStats() {
            const input = document.getElementById('steamInput').value.trim();
            const errorDiv = document.getElementById('error');
            const loadingDiv = document.getElementById('loading');
            const resultsDiv = document.getElementById('results');

            errorDiv.style.display = 'none';
            resultsDiv.innerHTML = '';

            if (!input) {
                errorDiv.textContent = 'Please enter a Steam profile URL or Steam ID';
                errorDiv.style.display = 'block';
                return;
            }

            loadingDiv.style.display = 'block';

            try {
                const response = await fetch('/api/stats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ steamInput: input })
                });

                const data = await response.json();
                loadingDiv.style.display = 'none';

                if (!response.ok) {
                    errorDiv.textContent = data.error || 'Failed to fetch stats';
                    errorDiv.style.display = 'block';
                    return;
                }

                displayStats(data);
            } catch (error) {
                loadingDiv.style.display = 'none';
                errorDiv.textContent = 'Error: ' + error.message;
                errorDiv.style.display = 'block';
            }
        }

        function displayStats(data) {
            const resultsDiv = document.getElementById('results');
            const { profile, stats } = data;

            resultsDiv.innerHTML = \`
                <div class="profile-header">
                    <img src="\${profile.avatarfull}" alt="Avatar" class="profile-avatar">
                    <div class="profile-info">
                        <h2>\${profile.personaname}</h2>
                        <a href="\${profile.profileurl}" target="_blank" class="profile-link">View Steam Profile →</a>
                    </div>
                </div>

                <div class="stats-container">
                    <div class="stat-card">
                        <h3>🎮 General Stats</h3>
                        <div class="stat-item">
                            <span class="stat-label">Total Playtime</span>
                            <span class="stat-value">\${stats.playtime || '0'} hours</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Account Created</span>
                            <span class="stat-value">\${new Date(profile.timecreated * 1000).toLocaleDateString()}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Profile Visibility</span>
                            <span class="stat-value">\${profile.communityvisibilitystate === 3 ? 'Public' : 'Private'}</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <h3>🔥 CS2 Stats</h3>
                        <div class="stat-item">
                            <span class="stat-label">Total Kills</span>
                            <span class="stat-value">\${stats.total_kills || 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total Deaths</span>
                            <span class="stat-value">\${stats.total_deaths || 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">K/D Ratio</span>
                            <span class="stat-value">\${stats.kd_ratio || 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total Wins</span>
                            <span class="stat-value">\${stats.total_wins || 'N/A'}</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <h3>🎯 Performance</h3>
                        <div class="stat-item">
                            <span class="stat-label">Headshot %</span>
                            <span class="stat-value">\${stats.headshot_percentage || 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Accuracy</span>
                            <span class="stat-value">\${stats.accuracy || 'N/A'}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Win Rate</span>
                            <span class="stat-value">\${stats.win_rate || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            \`;
        }

        // Allow Enter key to submit
        document.getElementById('steamInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') fetchStats();
        });
    </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve HTML
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(HTML_CONTENT, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // API endpoint for fetching stats
    if (url.pathname === '/api/stats' && request.method === 'POST') {
      try {
        const { steamInput } = await request.json();
        
        if (!steamInput) {
          return new Response(JSON.stringify({ error: 'Steam input is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Extract Steam ID from URL or use direct ID
        const steamId = extractSteamId(steamInput);
        
        if (!steamId) {
          return new Response(JSON.stringify({ error: 'Invalid Steam profile URL or ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Fetch Steam profile data
        const profileData = await fetchSteamProfile(steamId);
        
        // Fetch CS2 stats
        const statsData = await fetchCS2Stats(steamId);

        return new Response(JSON.stringify({
          profile: profileData,
          stats: statsData,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

// Extract Steam ID from various input formats
function extractSteamId(input) {
  // Direct Steam ID64
  if (/^\d{17}$/.test(input)) {
    return input;
  }

  // Steam profile URL patterns
  const patterns = [
    /steamcommunity\.com\/profiles\/(\d{17})/,
    /steamcommunity\.com\/id\/([^\/]+)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Fetch Steam profile information
async function fetchSteamProfile(steamId) {
  // If it's a vanity URL, resolve it first
  if (!/^\d{17}$/.test(steamId)) {
    const vanityUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${steamId}`;
    const vanityResponse = await fetch(vanityUrl);
    const vanityData = await vanityResponse.json();
    
    if (vanityData.response.success !== 1) {
      throw new Error('Could not resolve Steam profile. Make sure the profile is public.');
    }
    
    steamId = vanityData.response.steamid;
  }

  // Fetch player summaries
  const profileUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;
  const response = await fetch(profileUrl);
  const data = await response.json();

  if (!data.response.players.length) {
    throw new Error('Steam profile not found');
  }

  return data.response.players[0];
}

// Fetch CS2 stats
async function fetchCS2Stats(steamId) {
  const CS2_APP_ID = '730'; // CS2/CSGO App ID
  
  // Get user stats for CS2
  const statsUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?appid=${CS2_APP_ID}&key=${STEAM_API_KEY}&steamid=${steamId}`;
  
  try {
    const response = await fetch(statsUrl);
    const data = await response.json();

    if (!data.playerstats || !data.playerstats.stats) {
      return {
        playtime: 'N/A',
        total_kills: 'Private Profile',
        total_deaths: 'N/A',
        kd_ratio: 'N/A',
        total_wins: 'N/A',
        headshot_percentage: 'N/A',
        accuracy: 'N/A',
        win_rate: 'N/A'
      };
    }

    const stats = data.playerstats.stats;
    const statsMap = {};
    
    stats.forEach(stat => {
      statsMap[stat.name] = stat.value;
    });

    // Calculate derived stats
    const totalKills = statsMap['total_kills'] || 0;
    const totalDeaths = statsMap['total_deaths'] || 1;
    const totalWins = statsMap['total_wins'] || 0;
    const totalRoundsPlayed = statsMap['total_rounds_played'] || 1;
    const totalShotsFired = statsMap['total_shots_fired'] || 1;
    const totalShotsHit = statsMap['total_shots_hit'] || 0;

    return {
      playtime: Math.round((statsMap['total_time_played'] || 0) / 3600),
      total_kills: totalKills.toLocaleString(),
      total_deaths: totalDeaths.toLocaleString(),
      kd_ratio: (totalKills / totalDeaths).toFixed(2),
      total_wins: totalWins.toLocaleString(),
      headshot_percentage: statsMap['total_kills_headshot'] ? 
        ((statsMap['total_kills_headshot'] / totalKills) * 100).toFixed(1) + '%' : 'N/A',
      accuracy: ((totalShotsHit / totalShotsFired) * 100).toFixed(1) + '%',
      win_rate: ((totalWins / totalRoundsPlayed) * 100).toFixed(1) + '%'
    };

  } catch (error) {
    // Return default values if stats are not available
    return {
      playtime: 'N/A',
      total_kills: 'Stats unavailable',
      total_deaths: 'N/A',
      kd_ratio: 'N/A',
      total_wins: 'N/A',
      headshot_percentage: 'N/A',
      accuracy: 'N/A',
      win_rate: 'N/A'
    };
  }
}
