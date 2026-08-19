import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function Hub() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.5 } }
  };

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] md:min-h-screen gap-6 md:gap-10 w-full max-w-5xl p-4 relative overflow-hidden">
      
      {/* Background décoratif animé rotatif */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] md:w-[150vh] md:h-[150vh] animate-[spin_40s_linear_infinite] opacity-30">
          <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px]"></div>
        </div>
      </div>

      {/* Logo avec animation flottante et zoom léger */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 1.2, bounce: 0.5 }}
        className="z-10 w-full max-w-2xl flex justify-center drop-shadow-2xl"
      >
        <motion.img 
          src={`${import.meta.env.BASE_URL}logo.png`} 
          alt="À qui qu'elle est cette Tête de visage ?" 
          animate={{ scale: [1, 1.05, 1], rotate: [-1, 1, -1] }} 
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} 
          className="w-full h-auto object-contain max-h-[40vh]"
        />
      </motion.div>

      {/* Grille des boutons avec stagger */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="z-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-4xl flex-1 max-h-[40vh] md:max-h-none mb-4"
      >
        <motion.div variants={item} className="h-full">
           <MenuButton to="/display" color="blue" label="Écran Collectif" />
        </motion.div>
        <motion.div variants={item} className="h-full">
           <MenuButton to="/gamemaster" color="purple" label="Maître du Jeu" />
        </motion.div>
        <motion.div variants={item} className="h-full">
           <MenuButton to="/team" color="green" label="Chef d'Équipe" />
        </motion.div>
        <motion.div variants={item} className="h-full">
           <MenuButton to="/admin" color="red" label="Administration" />
        </motion.div>
      </motion.div>
    </div>
  );
}

function MenuButton({ to, color, label }: { to: string, color: 'blue' | 'purple' | 'green' | 'red', label: string }) {
  const colorClasses = {
    blue: "bg-gradient-to-b from-blue-400 to-blue-700 border-blue-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(30,58,138),0_10px_20px_rgba(0,0,0,0.5)] hover:from-blue-300 hover:to-blue-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(30,58,138),0_5px_10px_rgba(0,0,0,0.5)]",
    purple: "bg-gradient-to-b from-purple-400 to-purple-700 border-purple-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(88,28,135),0_10px_20px_rgba(0,0,0,0.5)] hover:from-purple-300 hover:to-purple-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(88,28,135),0_5px_10px_rgba(0,0,0,0.5)]",
    green: "bg-gradient-to-b from-green-400 to-green-700 border-green-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(20,83,45),0_10px_20px_rgba(0,0,0,0.5)] hover:from-green-300 hover:to-green-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(20,83,45),0_5px_10px_rgba(0,0,0,0.5)]",
    red: "bg-gradient-to-b from-red-400 to-red-700 border-red-900 shadow-[inset_0px_2px_4px_rgba(255,255,255,0.4),0_6px_0_rgb(153,27,27),0_10px_20px_rgba(0,0,0,0.5)] hover:from-red-300 hover:to-red-600 active:shadow-[inset_0px_2px_4px_rgba(255,255,255,0.2),0_2px_0_rgb(153,27,27),0_5px_10px_rgba(0,0,0,0.5)]"
  };

  return (
    <Link 
      to={to} 
      className={`
        ${colorClasses[color]} 
        text-white font-paytone text-xl md:text-2xl lg:text-3xl text-center p-4 md:p-6 rounded-3xl 
        border-2 border-b-4 uppercase tracking-wider h-full w-full
        transition-all active:translate-y-1
        flex items-center justify-center relative overflow-hidden
      `}
    >
      <span className="relative z-10 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{label}</span>
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-3xl pointer-events-none"></div>
    </Link>
  );
}
