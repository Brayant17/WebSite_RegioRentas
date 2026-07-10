import AllUsersTab from "@/modules/admin/usuarios/components/tabs/user-table/AllUsersTab";
import BrokerTab from "@/modules/admin/usuarios/components/tabs/broker-table/BrokerTab";
import { Tabs, TabsTrigger, TabsContent, TabsList} from "@/components/ui/tabs";
import VerificationTab from "./components/tabs/verification-table/VerificationTab";

export default function UsersPage() {
    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Usuarios</h1>
            <div className="mb-4 ">
                <Tabs defaultValue="all">
                    <div className="flex flex-wrap gap-2 justify-between mb-4">
                        <TabsList>
                            <TabsTrigger value="all">Todos</TabsTrigger>
                            <TabsTrigger value="broker">Solicitud Brokers</TabsTrigger>
                            <TabsTrigger value="verified">Solicitud de verificaciones</TabsTrigger>
                            {/* <TabsTrigger value="team">Equipo</TabsTrigger> */}
                        </TabsList>
                    </div>
                    <TabsContent value="all">
                        {/* <DataTable columns={columns} data={users} /> */}
                        <AllUsersTab/>
                    </TabsContent>
                    <TabsContent value="broker">
                        <BrokerTab />
                    </TabsContent>
                    <TabsContent value="verified">
                        <VerificationTab />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}