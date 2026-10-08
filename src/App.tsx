import { RouterProvider } from 'react-router-dom';
import { Providers } from '@/core/providers';
import { router } from '@/core/router';
import { ScrollToTop } from '@/shared/components/ScrollToTop';

const App = () => (
  <Providers>
    <RouterProvider router={router} />
    <ScrollToTop />
  </Providers>
);

export default App;
