import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './screens/auth/Login'
import Register from './screens/auth/Register'
import AdminDashboard from './screens/home/AdminDashboard'

function AppContent() {
  const [showLogin, setShowLogin] = useState(true); // true for login, false for register
  const { user, userProfile, loading, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  }

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-yellow-400 text-xl">Loading...</div>
      </div>
    )
  }

  // If user is logged in, show the appropriate dashboard
  if (user && userProfile) {
    if (userProfile.role === 'admin') {
      return <AdminDashboard key={`${user.id}-${userProfile.role}-admin`} onLogout={handleLogout} />;
    }
    // You can add a dashboard for regular users here
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <h1 className="text-3xl mb-4">Welcome, {userProfile.name || user.email}</h1>
        <p>You are logged in as a regular user.</p>
        <button onClick={handleLogout} className="mt-4 px-4 py-2 bg-yellow-400 text-black rounded">
          Logout
        </button>
      </div>
    );
  }

  // If user is not logged in, show Login or Register screen
  return showLogin ? (
    <Login 
      onSwitchToRegister={() => setShowLogin(false)} 
      onSuccess={() => { /* No action needed, component will re-render */ }} 
    />
  ) : (
    <Register 
      onSwitchToLogin={() => setShowLogin(true)} 
      onSuccess={() => {
        alert('Registration successful! Please check your email to confirm your account.');
        setShowLogin(true);
      }} 
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
