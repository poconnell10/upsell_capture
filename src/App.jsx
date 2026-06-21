import { Routes, Route } from 'react-router-dom';
import { CapturesProvider } from './store/captures.jsx';
import AgentSales from './pages/AgentSales.jsx';
import CaptureSale from './pages/CaptureSale.jsx';
import RoomsAndRates from './pages/RoomsAndRates.jsx';
import OtherRevenue from './pages/OtherRevenue.jsx';

export default function App() {
  return (
    <CapturesProvider>
      <Routes>
        <Route path="/" element={<AgentSales />} />
        <Route path="/capture" element={<CaptureSale />} />
        <Route path="/rooms" element={<RoomsAndRates />} />
        <Route path="/other" element={<OtherRevenue />} />
      </Routes>
    </CapturesProvider>
  );
}
