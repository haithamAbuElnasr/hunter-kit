import { ReactNode } from 'react';

export type DashboardMenu = {
  href: string;
  title: string;
  icon: ReactNode;
};

export type jobLoaders = {
  job: string;
  state: boolean;
};

export type ProjectDetails = {
  name: string;
  domain: string;
};