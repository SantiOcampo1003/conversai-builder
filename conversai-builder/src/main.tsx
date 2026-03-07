import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suprimir errores de extensiones de navegador
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';

  // Ignorar errores de extensiones de Chrome
  if (
    message.includes('Could not establish connection') ||
    message.includes('Receiving end does not exist') ||
    message.includes('runtime.lastError')
  ) {
    return;
  }

  originalError.apply(console, args);
};

createRoot(document.getElementById("root")!).render(<App />);
