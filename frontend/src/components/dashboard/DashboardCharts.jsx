import React from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatMoney } from '../../utils/format';

/**
 * DashboardCharts Component
 *
 * Renders the status distribution donut chart and top suppliers horizontal bar chart.
 * @component
 * @param {{
 *   statusDistribution: object[],
 *   topSuppliers: object[],
 *   topSuppliersCurrency: string|null,
 * }} props
 * @returns {JSX.Element}
 */
export default function DashboardCharts({ statusDistribution, topSuppliers, topSuppliersCurrency }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[400px]">
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-100 flex flex-col h-[300px] lg:h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">התפלגות סטטוסים</h3>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={5}
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow border border-gray-100 flex flex-col h-[300px] lg:h-full">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          ספקים מובילים (לפי סכום{topSuppliersCurrency ? `, ${topSuppliersCurrency}` : ''})
        </h3>
        <div className="flex-1 min-h-0" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSuppliers} margin={{ top: 5, right: 16, left: 4, bottom: 5 }} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={105} tick={{ fontSize: 11, fill: '#4b5563' }} />
              <Tooltip formatter={(value) => formatMoney(value, topSuppliersCurrency || 'ILS')} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
