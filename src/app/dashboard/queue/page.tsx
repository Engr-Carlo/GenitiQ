"use client";

import React from "react";
import Link from "next/link";
import { Cpu, Scan, ArrowRight, Layers3 } from "lucide-react";

const machineTypes = [
  {
    id: "vmm",
    label: "VMM",
    fullName: "Video Measuring Machine",
    description: "Optical non-contact measurement for precision components with visual inspection capabilities.",
    icon: <Scan size={48} strokeWidth={1.5} />,
    color: "from-primary-500 to-primary-700",
    count: 6,
  },
  {
    id: "cmm",
    label: "CMM",
    fullName: "Coordinate Measuring Machine",
    description: "Contact-based 3D measurement for high-precision dimensional inspection of machined parts.",
    icon: <Cpu size={48} strokeWidth={1.5} />,
    color: "from-navy-600 to-navy-800",
    count: 4,
  },
];

export default function QueueSelectionPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
            <Layers3 size={22} />
          </div>
          Queue Management
        </h1>
        <p className="text-gray-500 mt-1 ml-13">
          Select a machine type to view and manage the GA-optimized inspection queue.
        </p>
      </div>

      {/* Machine Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {machineTypes.map((type) => (
          <Link key={type.id} href={`/dashboard/queue/${type.id}`}>
            <div className="card group cursor-pointer border-2 border-transparent hover:border-primary-300 transition-all duration-300 hover:shadow-lg overflow-hidden">
              {/* Top gradient banner */}
              <div className={`bg-gradient-to-r ${type.color} p-6 text-white relative overflow-hidden`}>
                <div className="absolute top-0 right-0 opacity-10">
                  <div className="w-32 h-32 translate-x-8 -translate-y-8">{type.icon}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-wider">{type.label}</h2>
                    <p className="text-white/80 text-sm font-medium mt-1">{type.fullName}</p>
                  </div>
                  <div className="flex items-center gap-1 text-white/60 group-hover:text-white transition-colors">
                    <span className="text-sm font-bold">View Queue</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Info section */}
              <div className="p-5">
                <p className="text-gray-500 text-sm leading-relaxed">{type.description}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-success-500 animate-pulse`} />
                    <span className="text-sm font-bold text-gray-700">{type.count} Machines Active</span>
                  </div>
                  <span className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full uppercase">
                    GA-Optimized
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
