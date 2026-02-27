import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Suspense, lazy } from 'react';
import Upload from '../pages/Upload';
import Signature from '../pages/comparison/Signature';
import Report from '../pages/Report';
import Photo from '../pages/comparison/Photo';
import Login from '../pages/Login';
import CostAnalysis from '../pages/CostAnalysis';

import VideoComparison from '../pages/comparison/Video';
// import VideoComparison from '../pages/comparison/video/VideoComaprison.jsx';

// import LivenessCapture from '../pages/comparison/LivenessCapture.jsx';

import AuthProvider from '../components/auth/AuthProvider';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const Layout = lazy(() => import('../components/layout/Layout'));
const Dashboard = lazy(() => import('../pages/Dashboard'));

const AppRoutes = () => {
  const { isLoggedIn } = useSelector((state) => state.auth);

  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <AuthProvider>
          <Routes>
            <Route
              path='/login'
              element={isLoggedIn ? <Navigate to='/' replace /> : <Login />}
            />

            {/* Protected Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* <Route path='/' element={<Dashboard />} /> */}
              <Route path='/upload' element={<Upload />} />
              <Route path='/comparison/photo' element={<Photo />} />
              <Route path='/comparison/signature' element={<Signature />} />
              <Route path='/comparison/video' element={<VideoComparison />} />
              <Route path='/reports' element={<Report />} />
              <Route path='/cost-analysis' element={<CostAnalysis />} />
              <Route path='/document-library' element={<Report />} />
              {/* <Route path='/live' element={<LivenessCapture />} /> */}
            </Route>

            <Route
              path='*'
              element={
                <Navigate to={isLoggedIn ? '/upload' : '/login'} replace />
              }
            />
          </Routes>
        </AuthProvider>
      </Suspense>
    </BrowserRouter>
  );
};

export default AppRoutes;
