import { Outlet } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="min-h-screen w-full bg-sunburst flex flex-col items-center justify-center overflow-x-hidden font-paytone">
      <Outlet />
    </div>
  );
}
