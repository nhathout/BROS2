import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import loginVideo from "@/assets/login.mp4";
import "../styles/login.css";


const slides = [
  {
    title: " Block ROS made simple",
    text: " Drag, drop, deploy. Build robotic workflows without complex coding.",
  },
  {
    title: " Powerful Integrations",
    text: " Seamlessly connect with ROS2, Gazebo, and Isaac Sim for rapid prototyping.",
  },
  {
    title: " Deploy Anywhere",
    text: " Run your pipelines locally or push to the cloud — BROS scales with you.",
  },
];

function useTypewriter(text: string, speed = 50) {
  const [displayed, setDisplayed] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // ✅ Clear any existing interval before starting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!text) {
      setDisplayed("");
      return;
    }

    setDisplayed("");
    let i = 0;

    intervalRef.current = setInterval(() => {
      setDisplayed((prev) => {
        if (i < text.length) {
          const next = prev + text.charAt(i);
          i++;
          return next;
        } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
      });
    }, speed);

    // ✅ Cleanup when text or speed changes
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, speed]);

  return displayed;
}





const LandingPage: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState<"in" | "out">("in");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const navigate = useNavigate();

  const typedText = useTypewriter(slides[current].text, 40);

  // Slide timer
  useEffect(() => {
    const timer = setTimeout(() => {
      // fade out
      setFade("out");
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
        setFade("in");
      }, 400); // matches CSS fade
    }, 5000); // hold each slide for 5s

    return () => clearTimeout(timer);
  }, [current]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = 0.9;
  }, []);

  return (
    <>
      <header className="app-header">
        <span className="brand">BROS</span>
      </header>

      <div className="login-container">
        <div className="left-section">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="background-video"
          >
            <source src={loginVideo} type="video/mp4" />
          </video>

          <div className="overlay">
            <h1 className={`fade-title ${fade === "out" ? "out" : ""}`}>
              {slides[current].title}
            </h1>
            <p>
              {typedText}
              <span className="blinkingCursor">_</span>
            </p>

            <button className="continue-btn" onClick={() => navigate("/auth")}>
              Continue →
            </button>
          </div>

          <div className="dots">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`dot ${i === current ? "active" : ""}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
export default LandingPage;
