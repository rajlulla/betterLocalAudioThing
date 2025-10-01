// AppleScript fallback for DeskThing Local Audio app with color extraction
// This replaces the crashing native module with AppleScript integration

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AppleMusicNowPlaying {
  constructor(callback) {
    this.callback = callback;
    this.isRunning = false;
    this.intervalId = null;
    this.lastTrackData = null;
  }

  async subscribe() {
    if (this.isRunning) return;
    
    console.log('[AppleMusic Fallback] Starting AppleScript integration...');
    this.isRunning = true;
    
    // Start polling Apple Music every 2 seconds
    this.intervalId = setInterval(() => {
      this.pollAppleMusic();
    }, 2000);
    
    // Get initial state
    this.pollAppleMusic();
  }

  unsubscribe() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AppleMusic Fallback] Stopped AppleScript integration');
  }

  // Extract album artwork and save to temp file
  async extractAlbumArtwork(trackName, artistName) {
    try {
      const tempDir = path.join(__dirname, '../images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const artworkId = crypto.createHash('md5').update(`${trackName}-${artistName}`).digest('hex');
      const artworkPath = path.join(tempDir, `${artworkId}.jpg`);
      
      // Check if we already have this artwork cached
      if (fs.existsSync(artworkPath)) {
        return artworkPath;
      }
      
      const artworkScript = `
        tell application "Music"
          if it is running and player state is not stopped then
            set currentTrack to current track
            set artworkData to data of artwork 1 of currentTrack
            
            -- Write artwork to file
            set artworkFile to POSIX file "${artworkPath}"
            set fileRef to open for access artworkFile with write permission
            write artworkData to fileRef
            close access fileRef
            
            return "${artworkPath}"
          else
            return "no_artwork"
          end if
        end tell
      `;
      
      const result = execSync(`osascript -e '${artworkScript}'`, {
        encoding: 'utf8',
        timeout: 10000
      }).trim();
      
      if (result === 'no_artwork' || !fs.existsSync(artworkPath)) {
        return null;
      }
      
      console.log(`[AppleMusic Fallback] Extracted artwork: ${artworkPath}`);
      return artworkPath;
      
    } catch (error) {
      console.error('[AppleMusic Fallback] Error extracting artwork:', error.message);
      return null;
    }
  }
  
  // Extract dominant colors from album artwork using macOS tools
  async extractColorsFromArtwork(artworkPath) {
    try {
      if (!artworkPath || !fs.existsSync(artworkPath)) {
        return null;
      }
      
      // Use macOS sips command to analyze colors
      const colorScript = `
        # Create a small version for faster color analysis
        sips -z 50 50 "${artworkPath}" --out "${artworkPath}_small.jpg" > /dev/null 2>&1
        
        # Extract histogram data and find dominant colors
        python3 -c "
import sys
try:
    from PIL import Image
    import colorsys
    
    # Open and analyze image
    img = Image.open('${artworkPath}_small.jpg')
    img = img.convert('RGB')
    
    # Get color histogram
    colors = img.getcolors(maxcolors=256*256*256)
    if not colors:
        print('null')
        sys.exit()
    
    # Sort by frequency and get top colors
    colors.sort(reverse=True)
    
    def rgb_to_hex(r, g, b):
        return f'#{r:02x}{g:02x}{b:02x}'
    
    # Get dominant colors (skip too dark/light ones for better visuals)
    good_colors = []
    for count, (r, g, b) in colors[:20]:  # Check top 20 colors
        # Convert to HSV to check brightness
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        # Skip colors that are too dark, too light, or too desaturated
        if 0.15 < v < 0.85 and s > 0.2:
            good_colors.append((r, g, b))
        if len(good_colors) >= 3:
            break
    
    if len(good_colors) >= 2:
        primary = rgb_to_hex(*good_colors[0])
        secondary = rgb_to_hex(*good_colors[1])
        accent = rgb_to_hex(*good_colors[2]) if len(good_colors) > 2 else secondary
        print(f'{primary},{secondary},{accent}')
    else:
        print('null')
except ImportError:
    # Fallback: use ImageMagick if available
    import subprocess
    try:
        result = subprocess.check_output(['convert', '${artworkPath}_small.jpg', '-colors', '8', '-depth', '8', 'txt:-'], text=True)
        lines = [l for l in result.split('\\n') if 'srgb' in l]
        if len(lines) >= 2:
            colors = []
            for line in lines[:3]:
                hex_match = line.split('#')[1].split(' ')[0] if '#' in line else None
                if hex_match and len(hex_match) == 6:
                    colors.append('#' + hex_match)
            if len(colors) >= 2:
                print(','.join(colors[:3]))
            else:
                print('null')
        else:
            print('null')
    except:
        print('null')
except Exception as e:
    print('null')
" 2>/dev/null
        
        # Clean up temp file
        rm -f "${artworkPath}_small.jpg" 2>/dev/null
      `;
      
      const colorResult = execSync(colorScript, {
        encoding: 'utf8',
        timeout: 8000,
        shell: '/bin/bash'
      }).trim();
      
      if (colorResult === 'null' || !colorResult) {
        return this.generateFallbackColors();
      }
      
      const colors = colorResult.split(',');
      if (colors.length >= 2) {
        const colorData = {
          primary: colors[0],
          secondary: colors[1], 
          accent: colors[2] || colors[1],
          gradient: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
        };
        
        console.log(`[AppleMusic Fallback] Extracted colors:`, colorData);
        return colorData;
      }
      
      return this.generateFallbackColors();
      
    } catch (error) {
      console.error('[AppleMusic Fallback] Error extracting colors:', error.message);
      return this.generateFallbackColors();
    }
  }
  
  // Generate fallback colors when extraction fails
  generateFallbackColors() {
    const fallbackColors = [
      { primary: '#1DB954', secondary: '#1ED760', accent: '#1AA34A' }, // Spotify Green
      { primary: '#FF6B6B', secondary: '#FF8E8E', accent: '#FF4757' }, // Coral
      { primary: '#4ECDC4', secondary: '#26D0CE', accent: '#0FB9B1' }, // Teal
      { primary: '#45B7D1', secondary: '#6BCF7F', accent: '#96CEB4' }, // Blue-Green
      { primary: '#8E44AD', secondary: '#9B59B6', accent: '#A569BD' }, // Purple
    ];
    
    const chosen = fallbackColors[Math.floor(Math.random() * fallbackColors.length)];
    return {
      ...chosen,
      gradient: `linear-gradient(135deg, ${chosen.primary}, ${chosen.secondary})`
    };
  }

  async pollAppleMusic() {
    try {
      // Get current track info from Apple Music using AppleScript
      const script = `
        tell application "Music"
          if it is running then
            set playerState to player state as string
            if playerState is not "stopped" then
              set trackName to name of current track
              set artistName to artist of current track
              set albumName to album of current track
              set trackDuration to duration of current track
              set trackPosition to player position
              set isPlaying to (playerState is "playing")
              set shuffleEnabled to shuffle enabled
              set repeatMode to song repeat as string
              set playerVolume to sound volume
              
              return trackName & "|||" & artistName & "|||" & albumName & "|||" & trackDuration & "|||" & trackPosition & "|||" & isPlaying & "|||" & shuffleEnabled & "|||" & repeatMode & "|||" & playerVolume
            else
              return "stopped"
            end if
          else
            return "not_running"
          end if
        end tell
      `;

      const result = execSync(`osascript -e '${script}'`, { 
        encoding: 'utf8', 
        timeout: 5000 
      }).trim();

      if (result === 'not_running' || result === 'stopped') {
        // Music is not running or stopped
        if (this.lastTrackData) {
          this.callback({
            trackName: null,
            artist: null,
            album: null,
            trackDuration: null,
            trackProgress: null,
            isPlaying: false,
            shuffleState: null,
            repeatState: 'off',
            volume: null,
            thumbnail: null,
            canSkip: false,
            canGoBack: false,
            canLike: false,
            canFastForward: false,
            canChangeVolume: true
          });
          this.lastTrackData = null;
        }
        return;
      }

      const parts = result.split('|||');
      if (parts.length >= 9) {
        const trackName = parts[0] || null;
        const artistName = parts[1] || null;
        
        let trackData = {
          trackName,
          artist: artistName ? [artistName] : null,
          album: parts[2] || null,
          trackDuration: parseFloat(parts[3]) * 1000 || null, // Convert to milliseconds
          trackProgress: parseFloat(parts[4]) * 1000 || null, // Convert to milliseconds
          isPlaying: parts[5] === 'true',
          shuffleState: parts[6] === 'true' ? 'on' : 'off',
          repeatState: parts[7] === 'one' ? 'one' : parts[7] === 'all' ? 'all' : 'off',
          volume: parseInt(parts[8]) || null,
          thumbnail: null,
          canSkip: true,
          canGoBack: true,
          canLike: false,
          canFastForward: true,
          canChangeVolume: true,
          id: `${trackName}-${artistName}-${parts[2]}` // Create a unique ID
        };

        // Only send update if track data changed (excluding colors for comparison)
        const trackDataForComparison = { ...trackData };
        delete trackDataForComparison.color;
        delete trackDataForComparison.thumbnail;
        
        const trackDataString = JSON.stringify(trackDataForComparison);
        const isNewTrack = trackDataString !== this.lastTrackData;
        
        if (isNewTrack && trackName && artistName) {
          console.log(`[AppleMusic Fallback] New track: ${trackName} by ${artistName}`);
          
          // Try to extract artwork for thumbnail
          try {
            const artworkPath = await this.extractAlbumArtwork(trackName, artistName);
            if (artworkPath) {
              // Create thumbnail URL for DeskThing
              const artworkFilename = path.basename(artworkPath);
              trackData.thumbnail = `/resource/image/audio/${artworkFilename}`;
              console.log(`[AppleScript Fallback] Added thumbnail: ${artworkFilename}`);
            }
          } catch (error) {
            console.error('[AppleScript Fallback] Error processing artwork:', error.message);
          }
          
          this.callback(trackData);
          this.lastTrackData = trackDataString;
        } else if (!isNewTrack) {
          // For same track, just update progress/state without re-processing artwork
          this.callback(trackData);
        }
      }

    } catch (error) {
      console.error('[AppleMusic Fallback] Error polling Apple Music:', error.message);
    }
  }

  // Media control methods
  async play() {
    try {
      execSync(`osascript -e 'tell application "Music" to play'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error playing:', error.message);
    }
  }

  async pause() {
    try {
      execSync(`osascript -e 'tell application "Music" to pause'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error pausing:', error.message);
    }
  }

  async next() {
    try {
      execSync(`osascript -e 'tell application "Music" to next track'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error skipping:', error.message);
    }
  }

  async nextTrack() {
    return this.next();
  }

  async previous() {
    try {
      execSync(`osascript -e 'tell application "Music" to previous track'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error going back:', error.message);
    }
  }

  async previousTrack() {
    return this.previous();
  }

  // Additional methods that might be called
  async seekTo(positionMs) {
    try {
      const positionSeconds = positionMs / 1000;
      execSync(`osascript -e 'tell application "Music" to set player position to ${positionSeconds}'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error seeking:', error.message);
    }
  }

  async setShuffle(enabled) {
    try {
      execSync(`osascript -e 'tell application "Music" to set shuffle enabled to ${enabled}'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error setting shuffle:', error.message);
    }
  }

  async setVolume(volume) {
    try {
      execSync(`osascript -e 'tell application "Music" to set sound volume to ${volume}'`, { timeout: 3000 });
    } catch (error) {
      console.error('[AppleMusic Fallback] Error setting volume:', error.message);
    }
  }
}

// Export in both CommonJS and ES6 formats for compatibility
module.exports = { NowPlaying: AppleMusicNowPlaying };
module.exports.NowPlaying = AppleMusicNowPlaying;
module.exports.default = { NowPlaying: AppleMusicNowPlaying };
