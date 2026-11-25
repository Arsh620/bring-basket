import { MasterAccessNavigation } from '@/components/admin/MasterAccessNavigation';
import { ResourcePage } from '@/components/admin/ResourcePage';

export default function MasterRolesPage() {
  return <ResourcePage resourceKey="master-roles" navigation={<MasterAccessNavigation current="roles" />} />;
}
