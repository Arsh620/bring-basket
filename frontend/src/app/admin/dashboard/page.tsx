import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Tag, Bookmark, Warehouse } from 'lucide-react';

const stats = [
  { label: 'Total Items', icon: Package, value: '—', color: 'text-blue-600' },
  { label: 'Categories', icon: Tag, value: '—', color: 'text-green-600' },
  { label: 'Brands', icon: Bookmark, value: '—', color: 'text-purple-600' },
  { label: 'Warehouses', icon: Warehouse, value: '—', color: 'text-orange-600' },
];

export default function DashboardPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.label}</CardTitle>
                <stat.icon size={20} className={stat.color} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-800">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
