// frontend/src/components/RulesPage.js

import { Link } from "react-router-dom";
import logoSvg from "../assets/conniption_logo6.svg";

export default function RulesPage() {
  // Global rules that apply to all boards
  const globalRules = [
    {
      number: 1,
      title: "No illegal content",
      description:
        "Do not post content that violates local or United States law. This includes but is not limited to copyrighted material, illegal pornography, threats of violence, or personal information of others.",
    },
    {
      number: 2,
      title: "No spam or flooding",
      description:
        "Do not spam, flood, or otherwise disrupt the normal operation of the site. This includes excessive posting, creating duplicate threads, or posting off-topic content repeatedly.",
    },
    {
      number: 3,
      title: "No doxxing or raids",
      description:
        "Do not post personal information about others. Do not organize or participate in raids against other websites or communities.",
    },
    {
      number: 4,
      title: "NSFW content must stay in NSFW boards",
      description:
        "Keep adult content in boards marked as NSFW. Do not post NSFW content in SFW boards.",
    },
    {
      number: 5,
      title: "No advertising",
      description:
        "Do not use the site primarily for advertising or self-promotion. Occasional relevant links are allowed within context.",
    },
  ];

  // Board-specific rules
  const boardRules = [
    {
      boardId: "random",
      boardName: "Random",
      rules: [
        "Anything goes (within global rules)",
        "No thread topic restrictions",
        "NSFW content is allowed",
      ],
    },
    {
      boardId: "politics",
      boardName: "Politics",
      rules: [
        "Political and current events discussion only",
        "Respect opposing viewpoints",
        "Posting blatant misinformation will result in a ban",
      ],
    },
    {
      boardId: "tech",
      boardName: "Technology",
      rules: [
        "Technology-related topics only",
        "Cryptocurrency shilling goes in /business/",
      ],
    },
    {
      boardId: "gaming",
      boardName: "Gaming",
      rules: ["Video game discussion only"],
    },
    {
      boardId: "anime",
      boardName: "Anime",
      rules: [
        "Anime and manga discussion only",
        "Western animation discussion goes in /movies/",
        "Spoiler warnings required for recent episodes",
      ],
    },
    {
      boardId: "movies",
      boardName: "Movies",
      rules: [
        "Film and television discussion",
        "Spoiler warnings required for recent releases",
      ],
    },
    {
      boardId: "business",
      boardName: "Business",
      rules: [
        "Business and finance discussion only",
        "No excessive shilling of pump-and-dump schemes or cryptocurrencies",
      ],
    },
    {
      boardId: "diy",
      boardName: "Do It Yourself",
      rules: [
        "DIY projects and hobbies",
        "Projects with images are encouraged",
      ],
    },
    {
      boardId: "sports",
      boardName: "Sports",
      rules: ["Sports discussion only", "No excessive team bashing"],
    },
    {
      boardId: "fitness",
      boardName: "Fitness",
      rules: [
        "Fitness and health topics only",
        "No promotion of dangerous practices",
      ],
    },
    {
      boardId: "food",
      boardName: "Food",
      rules: ["Food and cooking discussion", "Recipe sharing encouraged"],
    },
    {
      boardId: "science",
      boardName: "Science",
      rules: [
        "Scientific discussion only",
        "Pseudoscience, free energy and other nonsense discouraged",
        "God is/isn't real threads go here",
        "Educational content encouraged",
      ],
    },
  ];

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
          <h1 className="h2 text-light">Site Rules</h1>
        </div>

        {/* Back to Home button */}
        <div className="mb-4">
          <Link to="/" className="btn btn-outline-light btn-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Global Rules Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h4 mb-0 text-light">Global Rules</h2>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-4">
              These rules apply to all boards and all content posted on
              Conniption. Violation of these rules may result in content
              removal, bans, or reports to authorities.
            </p>

            {globalRules.map((rule) => (
              <div key={rule.number} className="mb-4">
                <h5 className="text-warning">
                  {rule.number}. {rule.title}
                </h5>
                <p className="text-light ms-3">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Board-Specific Rules Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h4 mb-0 text-light">Board-Specific Rules</h2>
          </div>
          <div className="card-body">
            <p className="text-secondary mb-4">
              In addition to global rules, each board has its own specific rules
              and culture. Please read and follow these guidelines when posting.
            </p>

            <div className="row">
              {boardRules.map((board) => (
                <div key={board.boardId} className="col-md-6 mb-4">
                  <div className="card bg-dark border-secondary h-100">
                    <div className="card-header border-secondary">
                      <h5 className="mb-0">
                        <Link
                          to={`/board/${board.boardId}`}
                          className="text-decoration-none text-light"
                        >
                          /{board.boardId}/ - {board.boardName}
                        </Link>
                      </h5>
                    </div>
                    <div className="card-body">
                      <ul className="mb-0">
                        {board.rules.map((rule, index) => (
                          <li key={index} className="text-light">
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* General Guidelines Section */}
        <div className="card bg-mid-dark border-secondary shadow mb-4">
          <div className="card-header border-secondary">
            <h2 className="h4 mb-0 text-light">General Guidelines</h2>
          </div>
          <div className="card-body">
            <h5 className="text-info mb-3">Quality of Posts</h5>
            <ul className="text-light mb-4">
              <li>
                Make thoughtful, substantial posts that contribute to discussion
              </li>
              <li>
                Check if a thread already exists before creating a new one
              </li>
              <li>Use proper spelling and grammar when possible</li>
              <li>Stay on topic within threads</li>
            </ul>

            <h5 className="text-info mb-3">Image Posting</h5>
            <ul className="text-light mb-4">
              <li>Images must be under 4MB in size</li>
              <li>Supported formats: PNG, JPG, WebP, GIF, MP4, WebM</li>
              <li>Thread creation requires an image or video</li>
              <li>Replies can be text-only or include media</li>
            </ul>

            <h5 className="text-info mb-3">Ban Appeals</h5>
            <ul className="text-light mb-4">
              <li>
                If you are banned, you will see a ban notification with the
                reason
              </li>
              <li>You may submit one appeal per ban</li>
              <li>
                Appeals should be respectful and explain why the ban should be
                lifted
              </li>
              <li>Ban evasion will result in permanent bans</li>
            </ul>

            <h5 className="text-info mb-3">Moderation</h5>
            <ul className="text-light">
              <li>Moderators may delete posts or threads that violate rules</li>
              <li>Decisions are made at moderator discretion</li>
              <li>Repeated violations will result in longer bans</li>
              <li>Global rules supersede board-specific rules</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-secondary mt-4 pb-3">
          <p className="mb-1">
            <small>
              These rules are subject to change. Check back periodically for
              updates.
            </small>
          </p>
          <p className="mb-0">
            <small>Last updated: {new Date().toLocaleDateString()}</small>
          </p>
        </div>
      </div>
    </div>
  );
}
