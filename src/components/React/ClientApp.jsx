// App.jsx
import { AuthProvider } from "../../Context/AuthContext";
import NameUser from "../auth/NameUser";

export default function ClientApp() {
    return (
        <AuthProvider client:load >
            <h1 className="text-center">Bienvenido</h1>
            <NameUser />
        </AuthProvider>
    );
}