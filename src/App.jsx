import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { RequireVendor } from './auth/RequireVendor.jsx';
import Login from './pages/Login.jsx';
import AgentSales from './pages/AgentSales.jsx';
import CaptureSale from './pages/CaptureSale.jsx';
import RoomsAndRates from './pages/RoomsAndRates.jsx';
import OtherRevenue from './pages/OtherRevenue.jsx';
import Integrations from './pages/Integrations.jsx';
import AdminHotels from './pages/admin/AdminHotels.jsx';
import AdminAgents from './pages/admin/AdminAgents.jsx';
import AdminWebhooks from './pages/admin/AdminWebhooks.jsx';
import AdminDocs from './pages/admin/AdminDocs.jsx';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><AgentSales /></RequireAuth>} />
        <Route path="/capture" element={<RequireAuth><CaptureSale /></RequireAuth>} />
        <Route path="/rooms" element={<RequireAuth><RoomsAndRates /></RequireAuth>} />
        <Route path="/other" element={<RequireAuth><OtherRevenue /></RequireAuth>} />
        <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
        <Route path="/admin" element={<RequireVendor><AdminHotels /></RequireVendor>} />
        <Route path="/admin/hotels/:hotelId" element={<RequireVendor><AdminAgents /></RequireVendor>} />
        <Route path="/admin/webhooks" element={<RequireVendor><AdminWebhooks /></RequireVendor>} />
        <Route path="/admin/docs" element={<RequireVendor><AdminDocs /></RequireVendor>} />
      </Routes>
    </AuthProvider>
  );
}
