"use client";

// Campaign pipeline step identifiers in order
const PIPELINE_STEPS = [
  { id: "notify-start", label: "Notify Start" },
  { id: "generate-script", label: "Generate Script" },
  { id: "generate-voiceover", label: "Generate Voiceover" },
  { id: "start-video", label: "Start Video" },
  { id: "poll-video", label: "Poll Video" },
  { id: "distribute", label: "Distribute" },
  { id: "finalize", label: "Finalize" },
] as const;

type StepId = (typeof PIPELINE_STEPS)[number]["id"];

interface CampaignPipelineTimelineProps {
  currentStep: string;
  status: "processing" | "completed" | "failed";
}

type StepState = "completed" | "current" | "failed" | "pending";

function getStepState(
  stepId: StepId,
  currentStep: string,
  status: "processing" | "completed" | "failed",
  currentIndex: number,
  stepIndex: number
): StepState {
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) {
    if (status === "completed") return "completed";
    if (status === "failed") return "failed";
    return "current";
  }
  return "pending";
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "completed") {
    return (
      <span
        aria-label="Completed"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#16a34a",
          color: "#fff",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        ✓
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span
        aria-label="Failed"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#dc2626",
          color: "#fff",
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        ✕
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        aria-label="In progress"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "#2563eb",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12,
          animation: "spin 1s linear infinite",
        }}
      >
        ◌
      </span>
    );
  }
  return (
    <span
      aria-label="Pending"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "#d1d5db",
        color: "#6b7280",
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      ○
    </span>
  );
}

export function CampaignPipelineTimeline({
  currentStep,
  status,
}: CampaignPipelineTimelineProps) {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.id === currentStep);
  const resolvedIndex = currentIndex === -1 ? 0 : currentIndex;

  return (
    <div
      role="list"
      aria-label="Campaign pipeline progress"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 0,
        flexWrap: "wrap",
        rowGap: 16,
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {PIPELINE_STEPS.map((step, index) => {
        const state = getStepState(
          step.id,
          currentStep,
          status,
          resolvedIndex,
          index
        );
        const isLast = index === PIPELINE_STEPS.length - 1;

        return (
          <div
            key={step.id}
            role="listitem"
            style={{ display: "flex", alignItems: "center" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                minWidth: 72,
              }}
            >
              <StepIcon state={state} />
              <span
                style={{
                  fontSize: 11,
                  color:
                    state === "completed"
                      ? "#16a34a"
                      : state === "failed"
                        ? "#dc2626"
                        : state === "current"
                          ? "#2563eb"
                          : "#9ca3af",
                  fontWeight: state === "current" ? 600 : 400,
                  textAlign: "center",
                  maxWidth: 72,
                  lineHeight: "1.2",
                }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  height: 2,
                  width: 24,
                  background:
                    index < resolvedIndex ? "#16a34a" : "#e5e7eb",
                  flexShrink: 0,
                  marginBottom: 20,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CampaignPipelineTimeline;
