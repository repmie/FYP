import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "@/components/Shell";
import Home from "@/pages/Home";
import WhatIf from "@/pages/WhatIf";
import Accuracy from "@/pages/Accuracy";
import CorrelationLab from "@/pages/CorrelationLab";
import DataFiles from "@/pages/DataFiles";

function HomeRoute() {
  return <Shell><Home /></Shell>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/forecast" element={<Navigate to="/" replace />} />
        <Route path="/what-if" element={<WhatIf />} />
        <Route path="/accuracy" element={<Accuracy />} />
        <Route path="/about" element={<Navigate to="/accuracy" replace />} />
        <Route path="/correlation" element={<CorrelationLab />} />
        <Route path="/data" element={<DataFiles />} />
      </Routes>
    </BrowserRouter>
  );
}