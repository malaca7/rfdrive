import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-muted px-[6%]">
      <div className="text-center">
        <h1 className="mb-[3%] text-[clamp(2rem,8vw,2.5rem)] font-extrabold">404</h1>
        <p className="mb-[3%] text-[clamp(1rem,3.5vw,1.25rem)] text-muted-foreground">Página não encontrada</p>
        <a href="/" className="text-primary underline hover:text-primary/90 text-sm">
          Voltar ao início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
