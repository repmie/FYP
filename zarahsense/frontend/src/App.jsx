import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Shell } from "@/components/Shell";
import Home from "@/pages/Home";
import ForecastPage from "@/pages/ForecastPage";
import WhatIf from "@/pages/WhatIf";
import Accuracy from "@/pages/Accuracy";
import CorrelationLab from "@/pages/CorrelationLab";
import DataFiles from "@/pages/DataFiles";
import About from "@/pages/About";

function HomeRoute() {
  return <Shell><Home /></Shell>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/forecast" element={<ForecastPage />} />
        <Route path="/what-if" element={<WhatIf />} />
        <Route path="/accuracy" element={<Accuracy />} />
        <Route path="/correlation" element={<CorrelationLab />} />
        <Route path="/data" element={<DataFiles />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}