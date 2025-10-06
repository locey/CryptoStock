import React from "react";

export default function TokenCardSkeleton() {
  return (
    <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-800 rounded-xl"></div>
          <div>
            <div className="h-5 bg-gray-800 rounded w-12 mb-2"></div>
            <div className="h-4 bg-gray-800 rounded w-20"></div>
          </div>
        </div>
        <div className="w-16 h-6 bg-gray-800 rounded-lg"></div>
      </div>

      {/* Price skeleton */}
      <div className="bg-gray-800/50 rounded-xl p-3 mb-3">
        <div className="h-6 bg-gray-800 rounded w-24 mb-2"></div>
        <div className="h-4 bg-gray-800 rounded w-16"></div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="h-3 bg-gray-800 rounded w-12 mb-1"></div>
          <div className="h-4 bg-gray-800 rounded w-16"></div>
        </div>
        <div className="bg-gray-800/30 rounded-lg p-3">
          <div className="h-3 bg-gray-800 rounded w-8 mb-1"></div>
          <div className="h-4 bg-gray-800 rounded w-20"></div>
        </div>
      </div>

      {/* Description skeleton */}
      <div className="bg-gray-800/20 rounded-lg p-2.5 mb-3">
        <div className="space-y-2">
          <div className="h-3 bg-gray-800 rounded"></div>
          <div className="h-3 bg-gray-800 rounded w-3/4"></div>
        </div>
      </div>

      {/* Actions skeleton */}
      <div className="flex gap-2">
        <div className="h-10 bg-gray-800 rounded-lg flex-1"></div>
        <div className="h-10 bg-gray-800 rounded-lg flex-1"></div>
      </div>
    </div>
  );
}