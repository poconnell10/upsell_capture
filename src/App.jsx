import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { RequireVendor } from './auth/RequireVendor.jsx';
import Login from './pages/Login.jsx';
import AgentSales from './pages/AgentSales.jsx';
import CaptureSale from './pages/CaptureSale.jsx';
import RoomsAndRates from './pages/RoomsAndRates.jsx';
import OtherRevenue from './pages/OtherRevenue.jsx';
import AdminHotels from './pages/admin/AdminHotels.jsx';
import AdminAgents from './pages/admin/AdminAgents.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><AgentSales /></RequireAuth>} />
        <Route path="/capture" element={<RequireAuth><CaptureSale /></RequireAuth>} />
        <Route path="/rooms" element={<RequireAuth><RoomsAndRates /></RequireAuth>} />
        <Route path="/other" element={<RequireAuth><OtherRevenue /></RequireAuth>} />
        <Route path="/admin" element={<RequireVendor><AdminHotels /></RequireVendor>} />
        <Route path="/admin/hotels/:hotelId" element={<RequireVendor><AdminAgents /></RequireVendor>} />
      </Routes>
    </AuthProvider>
  );
}
