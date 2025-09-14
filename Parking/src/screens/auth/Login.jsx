import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import wheelLogo from '../../assets/images/icons/wheel.png';

const Login = ({ onSwitchToRegister, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await signIn(formData.email, formData.password);
      
      if (authError) {
        setError(authError.message);
      } else if (data.user) {
        onSuccess();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
                {/* Logo and Title */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-6">
            {/* Logo - Easily adjustable size */}
            <div 
              className="flex-shrink-0"
              style={{ width: '200px', height: '200px' }}
            >
              <img 
                src={wheelLogo} 
                alt="Parking Hub Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            {/* Title - Fixed positioning */}
            <h1 className="text-yellow-400 text-7xl font-bold whitespace-nowrap">
              Parking Hub
            </h1>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-4 bg-gray-900 bg-opacity-50 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:bg-gray-800 transition-all duration-200"
              required
            />
          </div>

          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-4 bg-gray-900 bg-opacity-50 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400 focus:bg-gray-800 transition-all duration-200"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-yellow-400 text-black font-bold text-lg rounded-md hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                LOGGING IN...
              </span>
            ) : (
              'LOGIN'
            )}
          </button>
        </form>

        {/* Links */}
        <div className="mt-8 text-center space-y-2">
          <a href="#" className="text-gray-400 hover:text-yellow-400 text-sm transition-colors block">
            Forgot Password?
          </a>
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-gray-400 hover:text-yellow-400 text-sm transition-colors"
          >
            Don't have an account? Sign up
          </button>
        </div>

        {/* Admin Credentials */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-xs">
            Admin: admin@parkinghub.com / admin123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 