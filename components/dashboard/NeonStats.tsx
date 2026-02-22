


export const NeonCircularProgress = ({
    percent,
    label,
    value,
    color = "cyan",
    unit = "",
    onClick
}: {
    percent: number;
    label: string;
    value: string;
    color?: "cyan" | "pink" | "yellow" | "purple" | "green";
    unit?: string;
    onClick?: () => void;
}) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    let strokeColor = "stroke-cyan-400";
    let shadowColor = "drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]";
    let textColor = "text-cyan-400";

    if (color === "pink") {
        strokeColor = "stroke-pink-500";
        shadowColor = "drop-shadow-[0_0_4px_rgba(236,72,153,0.8)]";
        textColor = "text-pink-500";
    } else if (color === "yellow") {
        strokeColor = "stroke-yellow-400";
        shadowColor = "drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]";
        textColor = "text-yellow-400";
    } else if (color === "purple") {
        strokeColor = "stroke-purple-500";
        shadowColor = "drop-shadow-[0_0_4px_rgba(168,85,247,0.8)]";
        textColor = "text-purple-500";
    } else if (color === "green") {
        strokeColor = "stroke-green-500";
        shadowColor = "drop-shadow-[0_0_4px_rgba(34,197,94,0.8)]";
        textColor = "text-green-500";
    }

    return (
        <div
            className={`flex flex-col items-center group ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest group-hover:text-white transition-colors">{label}</h4>
            <div className="relative w-24 h-24 transform transition-transform group-hover:scale-105">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        className="stroke-slate-700 fill-none"
                        strokeWidth="4"
                    />
                    <circle
                        cx="50%"
                        cy="50%"
                        r={radius}
                        className={`${strokeColor} fill-none ${shadowColor} transition-all duration-1000 ease-out`}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-xl font-black ${textColor} drop-shadow-md`}>{Math.round(percent)}%</span>
                </div>
            </div>
            <div className="mt-1 text-center">
                <p className={`text-xs font-bold ${textColor}`}>{value} <span className="text-[9px] opacity-70">{unit}</span></p>
            </div>
        </div>
    );
};

export const NeonLinearProgress = ({
    percent,
    label,
    value,
    target,
    color = "cyan",
    onClick
}: {
    percent: number;
    label: string;
    value: string;
    target: string;
    color?: "cyan" | "pink" | "yellow" | "purple";
    onClick?: () => void;
}) => {
    let barColor = "bg-cyan-400";
    let shadowColor = "shadow-[0_0_10px_rgba(34,211,238,0.6)]";
    let textColor = "text-cyan-400";
    let borderColor = "border-cyan-500/30";

    if (color === "pink") {
        barColor = "bg-pink-500";
        shadowColor = "shadow-[0_0_10px_rgba(236,72,153,0.6)]";
        textColor = "text-pink-500";
        borderColor = "border-pink-500/30";
    } else if (color === "yellow") {
        barColor = "bg-yellow-400";
        shadowColor = "shadow-[0_0_10px_rgba(250,204,21,0.6)]";
        textColor = "text-yellow-400";
        borderColor = "border-yellow-500/30";
    } else if (color === "purple") {
        barColor = "bg-purple-500";
        shadowColor = "shadow-[0_0_10px_rgba(168,85,247,0.6)]";
        textColor = "text-purple-500";
        borderColor = "border-purple-500/30";
    }

    return (
        <div
            className={`mb-4 group ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider group-hover:text-white transition-colors">{label}</span>
                <div className="flex gap-2 items-baseline">
                    <span className={`text-[10px] font-bold ${textColor}`}>{value} <span className="text-slate-500">/ {target}</span></span>
                    <span className={`text-xs font-black ${textColor}`}>{Math.round(percent)}%</span>
                </div>
            </div>
            <div className={`w-full h-3 bg-slate-800 rounded-sm border ${borderColor} p-[1px] relative overflow-hidden`}>
                <div
                    className={`h-full rounded-sm ${barColor} ${shadowColor} transition-all duration-1000 ease-out`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                ></div>
            </div>
        </div>
    );
};
