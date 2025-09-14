# 🚗 Smart Parking Hub System

A comprehensive QR-based parking management system with web admin dashboard and mobile application for seamless parking operations.

## 📱 Features

### Web Admin Dashboard

- **Real-time Parking Management**: Monitor all parking spaces in real-time
- **Vehicle Scanning**: QR code scanner for quick vehicle entry/exit
- **Comprehensive Reports**: Detailed analytics and booking reports
- **User Management**: Manage registered users and administrators
- **Payment Tracking**: Monitor payments and financial reports
- **Space Management**: Add and configure parking spaces

### Mobile Application (React Native)

- **QR Code Booking**: Quick parking space booking via QR codes
- **Vehicle Management**: Register and manage multiple vehicles
- **Payment Integration**: Secure payment processing
- **Booking History**: View past parking sessions
- **Real-time Updates**: Live parking availability updates
- **User Authentication**: Secure login and registration

## 🏗️ Project Structure

```
Parking Hub - QR Parking Management System/
├── Parking/                          # Web Application (Vite + React)
│   ├── src/                          # Web app source code
│   ├── server/                       # Express.js backend
│   ├── dist/                         # Built web application
│   └── package.json                  # Web app dependencies
├── Parking_Hub/                      # Mobile Application (Expo/React Native)
│   ├── src/                          # Mobile app source code
│   ├── assets/                       # Images, fonts, and other assets
│   └── package.json                  # Mobile app dependencies
└── README.md                         # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Expo CLI** (for mobile development)
- **Supabase account** (free database)

### 1. Clone the Repository

```bash
git clone git@github.com:Ruruu18/Smart-Parking-Hub-System.git
cd Smart-Parking-Hub-System
```

### 2. Set Up Database (Supabase)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key from Settings > API
4. Follow the detailed [Supabase Setup Guide](./Parking/SUPABASE_SETUP.md)

### 3. Install Dependencies

#### Web Application

```bash
cd Parking
npm install
```

#### Mobile Application

```bash
cd Parking_Hub
npm install
```

### 4. Environment Configuration

#### Web Application (.env.local)

Create `.env.local` in the `Parking` directory:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Server Configuration
PORT=3001
```

#### Mobile Application (.env)

Create `.env` in the `Parking_Hub` directory:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Start Development Servers

#### Web Application

```bash
cd Parking

# Start the frontend
npm run dev

# Start the backend server (in another terminal)
npm run server
```

Access at: http://localhost:5173

#### Mobile Application

```bash
cd Parking_Hub

# Start Expo development server
npm start

# For specific platforms
npm run android    # Android
npm run ios        # iOS
npm run web        # Web
```

## 📋 Development Scripts

### Web Application

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run server     # Start Express.js backend
npm run lint       # Run ESLint
```

### Mobile Application

```bash
npm start          # Start Expo development server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web
npm run server     # Start mobile backend server
```

## 🛠️ Technology Stack

### Frontend Technologies

- **React 19** - Modern UI library
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript

### Mobile Technologies

- **React Native** - Cross-platform mobile development
- **Expo** - React Native development platform
- **React Navigation** - Navigation library
- **Styled Components** - CSS-in-JS styling

### Backend Technologies

- **Express.js** - Node.js web framework
- **Supabase** - Backend-as-a-Service (Database + Auth)
- **PostgreSQL** - Relational database (via Supabase)
- **CORS** - Cross-origin resource sharing

### Additional Libraries

- **QR Code Generation**: react-native-qrcode-svg, qr-scanner
- **PDF Generation**: jspdf
- **Date Handling**: date-fns
- **HTTP Client**: axios
- **State Management**: React Context API

## 🗄️ Database Schema

The application uses the following main tables:

- **user_profiles**: User information and roles
- **parking_spaces**: Available parking spaces
- **parking_sessions**: Active and completed parking sessions
- **payments**: Payment records and transactions

Detailed schema and setup instructions are available in [SUPABASE_SETUP.md](./Parking/SUPABASE_SETUP.md).

## 🔐 Authentication & Authorization

- **User Registration/Login**: Handled by Supabase Auth
- **Role-Based Access**: Admin and User roles
- **Row Level Security**: Database-level security policies
- **JWT Tokens**: Secure authentication tokens

## 📱 Mobile App Features

### Core Functionality

- **QR Code Scanning**: Quick space booking
- **Vehicle Management**: Add/edit registered vehicles
- **Real-time Availability**: Live parking space updates
- **Payment Processing**: Secure payment integration
- **Booking History**: View past parking sessions

### User Interface

- **Modern Design**: Clean and intuitive interface
- **Dark/Light Mode**: Theme customization
- **Responsive Layout**: Works on all device sizes
- **Smooth Animations**: Enhanced user experience

## 🌐 Web Dashboard Features

### Admin Panel

- **Real-time Monitoring**: Live parking space status
- **Vehicle Scanner**: QR code scanning for entry/exit
- **Analytics Dashboard**: Comprehensive reports
- **User Management**: Manage registered users
- **Payment Tracking**: Financial reports and analytics

### Reports & Analytics

- **Booking Reports**: Detailed booking analytics
- **Revenue Reports**: Financial performance tracking
- **Space Utilization**: Parking space efficiency metrics
- **User Activity**: User engagement analytics

## 🚀 Deployment

### Web Application

1. Build the application: `npm run build`
2. Deploy the `dist` folder to your hosting provider
3. Set up environment variables on your server
4. Configure your domain and SSL certificate

### Mobile Application

1. Build for production: `expo build`
2. Submit to app stores (Google Play, Apple App Store)
3. Configure push notifications and analytics

### Recommended Hosting

- **Web**: Vercel, Netlify, or similar
- **Database**: Supabase (free tier available)
- **Mobile**: Expo EAS Build for app store deployment

## 🔧 Configuration

### Environment Variables

Both applications require proper environment configuration:

- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_ANON_KEY**: Your Supabase anonymous key
- **Additional keys**: Payment processing, analytics, etc.

### Custom Configuration

You can customize various aspects:

- **Parking Rates**: Modify in database or admin panel
- **UI Themes**: Update Tailwind config or styled components
- **Business Logic**: Modify in respective source files

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection**: Verify Supabase credentials
2. **CORS Errors**: Check server configuration
3. **Build Failures**: Ensure all dependencies are installed
4. **Mobile Development**: Verify Expo CLI installation

### Getting Help

1. Check the console for error messages
2. Verify environment variables are set correctly
3. Ensure database tables are created (run setup SQL)
4. Check network connectivity

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support and questions:

- Create an issue in this repository
- Contact the development team
- Check the documentation and setup guides

---

**Happy Parking! 🚗✨**
