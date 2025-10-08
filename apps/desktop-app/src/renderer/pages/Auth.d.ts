import React from "react";
import "../styles/Auth.css";
type Props = {
    onLoginGitHub: () => void;
    onLoginGoogle: () => void;
};
declare const AuthPage: React.FC<Props>;
export default AuthPage;
