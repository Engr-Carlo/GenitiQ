import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "INSPECTOR" | "OPERATOR" | "QA_QC" | "ADMIN";
      accountId: string;
      department: string;
      position: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: "INSPECTOR" | "OPERATOR" | "QA_QC" | "ADMIN";
    accountId: string;
    department: string;
    position: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "INSPECTOR" | "OPERATOR" | "QA_QC" | "ADMIN";
    accountId: string;
    department: string;
    position: string;
  }
}
