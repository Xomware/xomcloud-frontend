// app-routing.module.ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { MyProfileComponent } from './pages/my-profile/my-profile.component';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
import { LikedTracksComponent } from './pages/liked-tracks/liked-tracks.component';
import { UserTracksComponent } from './pages/user-tracks/user-tracks.component';
import { PlaylistsComponent } from './pages/playlists/playlists.component';
import { UserPlaylistsComponent } from './pages/user-playlists/user-playlists.component';
import { FollowersComponent } from './pages/followers/followers.component';
import { FollowingComponent } from './pages/following/following.component';
import { SearchComponent } from './pages/search/search.component';
import { MyCrateComponent } from './pages/my-crate/my-crate.component';
import { CallbackComponent } from './components/callback/callback.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: 'home', component: HomeComponent },
  { path: 'callback', component: CallbackComponent },
  {
    path: 'my-profile',
    component: MyProfileComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'user-profile',
    component: UserProfileComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'liked-tracks',
    component: LikedTracksComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'user-tracks',
    component: UserTracksComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'playlists',
    component: PlaylistsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'user-playlists',
    component: UserPlaylistsComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'followers',
    component: FollowersComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'following',
    component: FollowingComponent,
    canActivate: [AuthGuard],
  },
  { path: 'search', component: SearchComponent, canActivate: [AuthGuard] },
  { path: 'my-crate', component: MyCrateComponent, canActivate: [AuthGuard] },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
