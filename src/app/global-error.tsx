"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>The application crashed</h2>
          <p style={{ color: "#666", maxWidth: 360 }}>
            A critical error occurred. Please try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
