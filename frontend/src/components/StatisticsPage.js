// frontend/src/components/StatisticsPage.js

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import logoSvg from "../assets/conniption_logo6.svg";
import LoadingSpinner from "./LoadingSpinner";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function StatisticsPage() {
  const [stats, setStats] = useState(null);
  const [hourlyData, setHourlyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("24");

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    if (stats) {
      fetchHourlyData();
    }
  }, [selectedTimeframe]);

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (!response.ok) {
        throw new Error("Failed to fetch statistics");
      }
      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching statistics:", err);
      setError("Failed to load statistics. Please try again later.");
      setLoading(false);
    }
  };

  const fetchHourlyData = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/stats/hourly?hours=${selectedTimeframe}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch hourly data");
      }
      const data = await response.json();
      setHourlyData(data);
    } catch (err) {
      console.error("Error fetching hourly data:", err);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading statistics..." />;
  }

  if (error) {
    return (
      <div className="container-fluid min-vh-100 d-flex align-items-center justify-content-center bg-dark text-light">
        <div className="card bg-dark text-light border-secondary p-4 shadow">
          <div className="card-body text-center">
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#ffffff",
        },
      },
      title: {
        display: true,
        color: "#ffffff",
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#ffffff",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
      y: {
        ticks: {
          color: "#ffffff",
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
    },
  };

  // Visitor activity line chart
  const visitorChartData = hourlyData
    ? {
        labels: hourlyData.data.views.map((item) =>
          new Date(item.hour).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        ),
        datasets: [
          {
            label: "Unique Visitors",
            data: hourlyData.data.views.map((item) => item.unique_visitors),
            borderColor: "rgb(75, 192, 192)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.1,
          },
          {
            label: "Page Views",
            data: hourlyData.data.views.map((item) => item.page_views),
            borderColor: "rgb(255, 99, 132)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            tension: 0.1,
          },
        ],
      }
    : null;

  // Posts activity line chart
  const postsChartData = hourlyData
    ? {
        labels: hourlyData.data.posts.map((item) =>
          new Date(item.hour).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        ),
        datasets: [
          {
            label: "Posts Created",
            data: hourlyData.data.posts.map((item) => item.posts_count),
            borderColor: "rgb(153, 102, 255)",
            backgroundColor: "rgba(153, 102, 255, 0.2)",
            tension: 0.1,
          },
        ],
      }
    : null;

  // Board activity bar chart
  const boardChartData = {
    labels: stats.boards.map((board) => board.boardName),
    datasets: [
      {
        label: "Posts (Last 24h)",
        data: stats.boards.map((board) => board.postsDay),
        backgroundColor: "rgba(54, 162, 235, 0.8)",
      },
      {
        label: "Posts (Last Month)",
        data: stats.boards.map((board) => board.postsMonth),
        backgroundColor: "rgba(255, 206, 86, 0.8)",
      },
    ],
  };

  // Top countries doughnut chart for views
  const topCountriesViewData = {
    labels: stats.countries.views
      .slice(0, 10)
      .map((country) => country.countryName),
    datasets: [
      {
        label: "Unique Visitors",
        data: stats.countries.views
          .slice(0, 10)
          .map((country) => country.uniqueVisitors),
        backgroundColor: [
          "rgba(255, 99, 132, 0.8)",
          "rgba(54, 162, 235, 0.8)",
          "rgba(255, 206, 86, 0.8)",
          "rgba(75, 192, 192, 0.8)",
          "rgba(153, 102, 255, 0.8)",
          "rgba(255, 159, 64, 0.8)",
          "rgba(199, 199, 199, 0.8)",
          "rgba(83, 102, 255, 0.8)",
          "rgba(255, 99, 255, 0.8)",
          "rgba(99, 255, 132, 0.8)",
        ],
      },
    ],
  };

  // Top countries bar chart for posts
  const topCountriesPostData = {
    labels: stats.countries.posts
      .slice(0, 10)
      .map((country) => country.countryName),
    datasets: [
      {
        label: "Total Posts",
        data: stats.countries.posts
          .slice(0, 10)
          .map((country) => country.totalPosts),
        backgroundColor: "rgba(75, 192, 192, 0.8)",
      },
    ],
  };

  return (
    <div className="container-fluid min-vh-100 bg-dark text-light py-4">
      <div className="container">
        <div className="text-center mb-4">
          <img
            src={logoSvg}
            alt="Conniption Logo"
            style={{ maxHeight: "80px", maxWidth: "100%" }}
            className="img-fluid mb-3"
          />
        </div>

        {/* Back to Home button */}
        <div className="mb-4">
          <Link to="/" className="btn btn-outline-light btn-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Page Title */}
        <div className="text-center mb-4">
          <h1 className="display-4">Site Statistics</h1>
          <p className="text-secondary">
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
          </p>
        </div>

        {/* Overall Statistics Cards */}
        <div className="row mb-4">
          <div className="col-md-3 mb-3">
            <div className="card bg-secondary text-white h-100">
              <div className="card-body text-center">
                <h5 className="card-title">Lifetime Visitors</h5>
                <p className="display-6">
                  {stats.overall.uniqueVisitorsLifetime.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card bg-info text-white h-100">
              <div className="card-body text-center">
                <h5 className="card-title">Last Month</h5>
                <p className="display-6">
                  {stats.overall.uniqueVisitorsMonth.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card bg-success text-white h-100">
              <div className="card-body text-center">
                <h5 className="card-title">Last 24 Hours</h5>
                <p className="display-6">
                  {stats.overall.uniqueVisitorsDay.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card bg-warning text-dark h-100">
              <div className="card-body text-center">
                <h5 className="card-title">Last Hour</h5>
                <p className="display-6">
                  {stats.overall.uniqueVisitorsHour.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Charts */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-mid-dark border-secondary">
              <div className="card-header border-secondary d-flex justify-content-between align-items-center">
                <h3 className="h5 mb-0">Visitor Activity</h3>
                <select
                  className="form-select form-select-sm bg-dark text-light border-secondary"
                  style={{ width: "auto" }}
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                >
                  <option value="24">Last 24 Hours</option>
                  <option value="48">Last 48 Hours</option>
                  <option value="168">Last 7 Days</option>
                </select>
              </div>
              <div className="card-body">
                <div style={{ height: "300px" }}>
                  {visitorChartData && (
                    <Line data={visitorChartData} options={chartOptions} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-mid-dark border-secondary">
              <div className="card-header border-secondary">
                <h3 className="h5 mb-0">Post Activity</h3>
              </div>
              <div className="card-body">
                <div style={{ height: "300px" }}>
                  {postsChartData && (
                    <Line data={postsChartData} options={chartOptions} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Board Statistics */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-mid-dark border-secondary">
              <div className="card-header border-secondary">
                <h3 className="h5 mb-0">Board Activity</h3>
              </div>
              <div className="card-body">
                <div style={{ height: "400px" }}>
                  <Bar data={boardChartData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="row mb-4">
          <div className="col-md-6 mb-3">
            <div className="card bg-mid-dark border-secondary h-100">
              <div className="card-header border-secondary">
                <h3 className="h5 mb-0">Top Countries by Visitors</h3>
              </div>
              <div className="card-body">
                <div style={{ height: "300px" }}>
                  <Doughnut
                    data={topCountriesViewData}
                    options={{
                      ...chartOptions,
                      plugins: {
                        ...chartOptions.plugins,
                        legend: {
                          ...chartOptions.plugins.legend,
                          position: "right",
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-6 mb-3">
            <div className="card bg-mid-dark border-secondary h-100">
              <div className="card-header border-secondary">
                <h3 className="h5 mb-0">Top Countries by Posts</h3>
              </div>
              <div className="card-body">
                <div style={{ height: "300px" }}>
                  <Bar
                    data={topCountriesPostData}
                    options={{
                      ...chartOptions,
                      indexAxis: "y",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Board Statistics Table */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-mid-dark border-secondary">
              <div className="card-header border-secondary">
                <h3 className="h5 mb-0">Board Statistics Details</h3>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-dark table-hover">
                    <thead>
                      <tr>
                        <th>Board</th>
                        <th className="text-end">Hour</th>
                        <th className="text-end">Day</th>
                        <th className="text-end">Month</th>
                        <th className="text-end">Lifetime</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.boards.map((board) => (
                        <tr key={board.boardId}>
                          <td>
                            <Link
                              to={`/board/${board.boardId}`}
                              className="text-decoration-none text-light"
                            >
                              /{board.boardId}/ - {board.boardName}
                            </Link>
                          </td>
                          <td className="text-end">
                            {board.postsHour.toLocaleString()}
                          </td>
                          <td className="text-end">
                            {board.postsDay.toLocaleString()}
                          </td>
                          <td className="text-end">
                            {board.postsMonth.toLocaleString()}
                          </td>
                          <td className="text-end">
                            {board.postsLifetime.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-secondary mt-4 pb-3">
          <p className="mb-0">
            <small>
              Statistics are updated every 5 minutes. All data is anonymized.
            </small>
          </p>
        </div>
      </div>
    </div>
  );
}
