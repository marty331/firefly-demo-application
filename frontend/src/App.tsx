import { Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import CropImagePage from "./pages/CropImagePage";
import RemoveBackgroundPage from "./pages/RemoveBackgroundPage";
import ExpandImagePage from "./pages/ExpandImagePage";
import AutoTonePage from "./pages/AutoTonePage";
import VideoReframePage from "./pages/VideoReframePage";
// import BannerVariantsPage from './pages/BannerVariantsPage'
import TextToVideoPage from "./pages/TextToVideoPage";
import Layout from "./components/Layout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="crop-image" element={<CropImagePage />} />
        <Route path="remove-background" element={<RemoveBackgroundPage />} />
        <Route path="color-grade" element={<AutoTonePage />} />
        <Route path="video-reframe" element={<VideoReframePage />} />
        <Route path="resize" element={<ExpandImagePage />} />
        {/*
        <Route path="banner-variants" element={<BannerVariantsPage />} />*/}
        <Route path="text-to-video" element={<TextToVideoPage />} />
      </Route>
    </Routes>
  );
}

export default App;
