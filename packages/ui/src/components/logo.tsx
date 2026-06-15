import { ComponentProps } from "solid-js"

/** Compact Mimo "M" mark — used as icon/favicon-style mark */
export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M2 18V2L10 10L18 2V18H14V9L10 13L6 9V18H2Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

/** Large Mimo splash mark for loading screens */
export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10 90V10L50 50L90 10V90H70V45L50 65L30 45V90H10Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

/** Full Mimo wordmark — "MIMO" in geometric sans style */
export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 40"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      {/* M */}
      <path d="M4 36V4L20 22L36 4V36H30V16L20 28L10 16V36H4Z" fill="var(--icon-strong-base)" />
      {/* I */}
      <rect x="44" y="4" width="6" height="32" fill="var(--icon-strong-base)" />
      {/* M */}
      <path d="M60 36V4L76 22L92 4V36H86V16L76 28L66 16V36H60Z" fill="var(--icon-strong-base)" />
      {/* O */}
      <path
        d="M101 25C101 18.9 105.5 14 112 14C118.5 14 123 18.9 123 25C123 31.1 118.5 36 112 36C105.5 36 101 31.1 101 25ZM107 25C107 28 109.2 30.5 112 30.5C114.8 30.5 117 28 117 25C117 22 114.8 19.5 112 19.5C109.2 19.5 107 22 107 25Z"
        fill="var(--icon-strong-base)"
      />
    </svg>
  )
}

/** Animated Mimo splash with shine effect for loading screens */
export const AnimatedSplash = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-animated-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 200 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="shine-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="transparent" />
          <stop offset="40%" stop-color="transparent" />
          <stop offset="50%" stop-color="rgba(255,255,255,0.6)" />
          <stop offset="60%" stop-color="transparent" />
          <stop offset="100%" stop-color="transparent" />
        </linearGradient>
        <clipPath id="mimo-clip">
          <path d="M4 36V4L20 22L36 4V36H30V16L20 28L10 16V36H4Z" />
          <rect x="48" y="4" width="6" height="32" />
          <path d="M64 36V4L80 22L96 4V36H90V16L80 28L70 16V36H64Z" />
          <path d="M109 25C109 18.9 113.5 14 120 14C126.5 14 131 18.9 131 25C131 31.1 126.5 36 120 36C113.5 36 109 31.1 109 25ZM115 25C115 28 117.2 30.5 120 30.5C122.8 30.5 125 28 125 25C125 22 122.8 19.5 120 19.5C117.2 19.5 115 22 115 25Z" />
        </clipPath>
      </defs>
      <g clip-path="url(#mimo-clip)">
        {/* M */}
        <path d="M4 36V4L20 22L36 4V36H30V16L20 28L10 16V36H4Z" fill="var(--icon-strong-base)" />
        {/* I */}
        <rect x="48" y="4" width="6" height="32" fill="var(--icon-strong-base)" />
        {/* M */}
        <path d="M64 36V4L80 22L96 4V36H90V16L80 28L70 16V36H64Z" fill="var(--icon-strong-base)" />
        {/* O */}
        <path
          d="M109 25C109 18.9 113.5 14 120 14C126.5 14 131 18.9 131 25C131 31.1 126.5 36 120 36C113.5 36 109 31.1 109 25ZM115 25C115 28 117.2 30.5 120 30.5C122.8 30.5 125 28 125 25C125 22 122.8 19.5 120 19.5C117.2 19.5 115 22 115 25Z"
          fill="var(--icon-strong-base)"
        />
        {/* Shine overlay */}
        <rect x="-131" y="-20" width="131" height="80" fill="url(#shine-gradient)" style={{ animation: "mimo-shine 1.5s ease-in-out forwards" }} />
      </g>
    </svg>
  )
}
