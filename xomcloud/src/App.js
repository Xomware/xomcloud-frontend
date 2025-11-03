import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000/api";

function App() {
  const [token, setToken] = useState(localStorage.getItem("sc_token"));
  const [user, setUser] = useState(null);
  const [view, setView] = useState("likes"); // 'likes' or 'playlists'
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchUser();
      fetchLikes();
    }
  }, [token]);

  useEffect(() => {
    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && !token) {
      exchangeToken(code);
    }
  }, []);

  const login = async () => {
    const response = await axios.get(`${API_BASE}/auth/url`);
    window.location.href = response.data.url;
  };

  const exchangeToken = async (code) => {
    try {
      const response = await axios.post(`${API_BASE}/auth/token`, { code });
      const accessToken = response.data.access_token;
      setToken(accessToken);
      localStorage.setItem("sc_token", accessToken);
      window.history.replaceState({}, document.title, "/");
    } catch (error) {
      console.error("Token exchange failed:", error);
    }
  };

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_BASE}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  };

  const fetchLikes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/user/likes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTracks(response.data);
      setView("likes");
    } catch (error) {
      console.error("Failed to fetch likes:", error);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const response = await axios.get(`${API_BASE}/user/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(response.data);
      setView("playlists");
    } catch (error) {
      console.error("Failed to fetch playlists:", error);
    }
  };

  const fetchPlaylistTracks = async (playlistId) => {
    try {
      const response = await axios.get(`${API_BASE}/playlist/${playlistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTracks(response.data.tracks);
      setView("playlist_tracks");
    } catch (error) {
      console.error("Failed to fetch playlist tracks:", error);
    }
  };

  const toggleTrackSelection = (track) => {
    const trackUrl = track.permalink_url;
    if (selectedTracks.includes(trackUrl)) {
      setSelectedTracks(selectedTracks.filter((url) => url !== trackUrl));
    } else {
      setSelectedTracks([...selectedTracks, trackUrl]);
    }
  };

  const selectAll = () => {
    const allUrls = tracks.map((t) => t.permalink_url);
    setSelectedTracks(allUrls);
  };

  const deselectAll = () => {
    setSelectedTracks([]);
  };

  const downloadSelected = async () => {
    if (selectedTracks.length === 0) {
      alert("Please select tracks to download");
      return;
    }

    setDownloading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/download`,
        { urls: selectedTracks },
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `xomcloud_download_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      alert(`Successfully downloaded ${selectedTracks.length} tracks!`);
      deselectAll();
    } catch (error) {
      console.error("Download failed:", error);
      alert("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("sc_token");
    setToken(null);
    setUser(null);
    setTracks([]);
    setPlaylists([]);
    setSelectedTracks([]);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-4">xomcloud</h1>
          <p className="text-white text-xl mb-8">
            Download your SoundCloud favorites
          </p>
          <button
            onClick={login}
            className="bg-white text-orange-600 px-8 py-3 rounded-full font-semibold text-lg hover:bg-gray-100 transition"
          >
            Connect with SoundCloud
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-black p-4 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-orange-500">xomcloud</h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-gray-300">{user.username}</span>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-black p-6">
          <nav className="space-y-4">
            <button
              onClick={fetchLikes}
              className={`w-full text-left px-4 py-2 rounded transition ${
                view === "likes" ? "bg-orange-600" : "hover:bg-gray-800"
              }`}
            >
              ♥ Likes
            </button>
            <button
              onClick={fetchPlaylists}
              className={`w-full text-left px-4 py-2 rounded transition ${
                view === "playlists" ? "bg-orange-600" : "hover:bg-gray-800"
              }`}
            >
              📋 Playlists
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Download Controls */}
          {tracks.length > 0 && view !== "playlists" && (
            <div className="bg-gray-800 p-4 rounded-lg mb-6 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600 transition"
                >
                  Deselect All
                </button>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-300">
                  {selectedTracks.length} selected
                </span>
                <button
                  onClick={downloadSelected}
                  disabled={downloading || selectedTracks.length === 0}
                  className="bg-orange-600 px-6 py-2 rounded-lg hover:bg-orange-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {downloading ? "Downloading..." : "Download Selected"}
                </button>
              </div>
            </div>
          )}

          {/* Playlists View */}
          {view === "playlists" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  onClick={() => fetchPlaylistTracks(playlist.id)}
                  className="bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-gray-700 transition"
                >
                  {playlist.artwork_url && (
                    <img
                      src={playlist.artwork_url}
                      alt={playlist.title}
                      className="w-full h-48 object-cover rounded mb-4"
                    />
                  )}
                  <h3 className="font-semibold text-lg">{playlist.title}</h3>
                  <p className="text-gray-400 text-sm">
                    {playlist.track_count} tracks
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tracks View */}
          {tracks.length > 0 && view !== "playlists" && (
            <div className="space-y-2">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className={`bg-gray-800 p-4 rounded-lg flex items-center gap-4 cursor-pointer transition ${
                    selectedTracks.includes(track.permalink_url)
                      ? "bg-orange-900 border-2 border-orange-500"
                      : "hover:bg-gray-700"
                  }`}
                  onClick={() => toggleTrackSelection(track)}
                >
                  <div className="flex-shrink-0">
                    {track.artwork_url ? (
                      <img
                        src={track.artwork_url}
                        alt={track.title}
                        className="w-16 h-16 rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-700 rounded flex items-center justify-center">
                        🎵
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{track.title}</h3>
                    <p className="text-gray-400 text-sm truncate">
                      {track.user?.username || "Unknown Artist"}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {selectedTracks.includes(track.permalink_url) && (
                      <span className="text-orange-500">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
