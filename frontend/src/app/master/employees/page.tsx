import { MasterAccessNavigation } from '@/components/admin/MasterAccessNavigation';
import { ResourcePage } from '@/components/admin/ResourcePage';

export default function MasterEmployeesPage() {
  return <ResourcePage resourceKey="master-employees" navigation={<MasterAccessNavigation current="employees" />} />;
}
