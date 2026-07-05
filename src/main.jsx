import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { bootPlanEstimatorEmbed } from "./lib/planEstimatorEmbed.js";
import "./index.css";

bootPlanEstimatorEmbed();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
