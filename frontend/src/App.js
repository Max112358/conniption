import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

// Simple components for testing
const Home = () => (
  <div>
    Home Page <Link to="/test">Go to Test</Link>
  </div>
);
const Test = () => (
  <div>
    Test Page <Link to="/">Go Home</Link>
  </div>
);

export default function App() {
  console.log("Testing router configuration");
  return (
    <BrowserRouter>
      <div>
        <h1>Router Test App</h1>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/test" element={<Test />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
