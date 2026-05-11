import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, User, Key, ChevronRight } from 'lucide-react';

const ProtectedRoute = ({ children, allowedRole }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    // Hardcoded logic for task
    if (allowedRole === 'admin' && userId === 'admin' && password === 'admin123') {
      setIsAuthenticated(true);
    } else if (allowedRole === 'researcher' && userId === 'researcher' && password === 'researcher123') {
      setIsAuthenticated(true);
    } else {
      setError('Invalid ID or Password for this role.');
    }
  };

  if (isAuthenticated) {
    return children;
  }

  return (
    <div className="flex justify-center items-center h-[calc(100vh-200px)]">
      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 max-w-md w-full relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
        <div className="text-center mb-8">
          <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Access Restricted</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Please log in with your {allowedRole} credentials to continue.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 flex items-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}
          
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1 ml-1" htmlFor="userId">
              {allowedRole === 'admin' ? 'Admin ID' : 'Researcher ID'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/50 backdrop-blur-sm transition-shadow duration-200"
                placeholder={`Enter your ${allowedRole} ID`}
                required
              />
            </div>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1 ml-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white/50 backdrop-blur-sm transition-shadow duration-200"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-300 transform hover:-translate-y-0.5"
          >
            Authenticate Portal
            <ChevronRight className="ml-2 w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProtectedRoute;
