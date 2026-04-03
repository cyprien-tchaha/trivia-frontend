export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Trivia Night
        </h1>
        <p className="text-gray-400 text-xl">Real-time multiplayer trivia</p>
        <p className="text-gray-500 text-sm mt-2">Anime and TV Shows</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        
          <a href="/host"
          className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold text-lg text-center transition-colors"
        >
          Host a Game
        </a>
        
          <a href="/play"
          className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold text-lg text-center transition-colors"
        >
          Join a Game
        </a>
      </div>
      <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-md">
        <div>
          <p className="text-3xl font-bold text-purple-400">5</p>
          <p className="text-gray-500 text-sm mt-1">Difficulty levels</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-purple-400">2</p>
          <p className="text-gray-500 text-sm mt-1">Categories</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-purple-400">Live</p>
          <p className="text-gray-500 text-sm mt-1">Scoreboard</p>
        </div>
      </div>
    </main>
  );
}
