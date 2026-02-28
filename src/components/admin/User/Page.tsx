"use client";

// Encapsular las opcones de filtrado y busqueda 
// o refactorizar para reutilizar los filtros con sus propios parametros de cada TAB
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AllUsersTab from "./table/tabs/allUsers/AllUsersTab";
import BrokerTab from "./table/tabs/brokers/BrokerTab";


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
                            {/* <TabsTrigger value="verified">Solicitud Verificado</TabsTrigger> */}
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
                    <TabsContent value="team">
                        <span>Proximamente tabla de team</span>
                    </TabsContent>
                    <TabsContent value="verified">
                        <span>Proximamente tabla de usuarios verificados</span>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
