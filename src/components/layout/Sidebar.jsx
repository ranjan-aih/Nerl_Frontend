import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
} from '@mui/material';

import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import MonochromePhotosIcon from '@mui/icons-material/MonochromePhotos';
import CompareIcon from '@mui/icons-material/Compare';

import { GoVideo } from 'react-icons/go';
import { FaFileSignature } from 'react-icons/fa6';

import logo from '../../assets/NERL-Logo.png';
import aihorizonLogo from '../../assets/ai-horizon.iologo.png';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // const getActiveSubItem = () => {
  //   if (location.pathname === '/comparison/photo') return 'Photo';
  //   if (location.pathname === '/comparison/signature') return 'Signature';
  //   if (location.pathname === '/comparison/video') return 'Video';
  //   return '';
  // };

  const getActiveSubItem = () => {
    const parts = location.pathname.split('/');
    if (parts[1] === 'comparison' && parts[2]) {
      return parts[2].charAt(0).toUpperCase() + parts[2].slice(1);
    }
    return '';
  };

  const getOpenDropdown = () => {
    if (location.pathname.startsWith('/comparison')) return 'Comparison';
    return null;
  };

  const [openDropdown, setOpenDropdown] = useState(getOpenDropdown());
  const [activeSubItem, setActiveSubItem] = useState(getActiveSubItem());

  // useEffect(() => {
  //   if (location.pathname === '/comparison/photo') {
  //     setActiveSubItem('Photo');
  //     setOpenDropdown('Comparison');
  //   } else if (location.pathname === '/comparison/signature') {
  //     setActiveSubItem('Signature');
  //     setOpenDropdown('Comparison');
  //   } else if (location.pathname === '/comparison/video') {
  //     setActiveSubItem('Video');
  //     setOpenDropdown('Comparison');
  //   } else if (!location.pathname.startsWith('/comparison')) {
  //     setActiveSubItem('');
  //     setOpenDropdown(null);
  //   }
  // }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith('/comparison')) {
      const parts = location.pathname.split('/');
      if (parts[2]) {
        const label = parts[2].charAt(0).toUpperCase() + parts[2].slice(1);
        setActiveSubItem(label);
        setOpenDropdown('Comparison');
      }
    } else {
      setActiveSubItem('');
      setOpenDropdown(null);
    }
  }, [location.pathname]);

  const getActiveMainItem = () => {
    if (location.pathname.startsWith('/upload')) return 'Upload';
    if (location.pathname.startsWith('/comparison')) return 'Comparison';
    if (location.pathname.startsWith('/reports')) return 'Reports';
    if (location.pathname.startsWith('/cost-analysis')) return 'Cost Analysis';
    if (location.pathname.startsWith('/document-library'))
      return 'Document Library';
    return '';
  };

  const navItems = [
    { label: 'Upload', icon: <UploadFileOutlinedIcon />, path: '/upload' },
    {
      label: 'Comparison',
      icon: <CompareIcon />,
      subItems: [
        {
          label: 'Photo',
          icon: <MonochromePhotosIcon />,
          path: '/comparison/photo',
        },
        {
          label: 'Signature',
          icon: <FaFileSignature size={24} />,
          path: '/comparison/signature',
        },
        {
          label: 'Video',
          icon: <GoVideo size={24} />,
          path: '/comparison/video',
        },
      ],
    },
    { label: 'Reports', icon: <AssessmentOutlinedIcon />, path: '/reports' },
    {
      label: 'Cost Analysis',
      icon: <AssessmentOutlinedIcon />,
      path: '/cost-analysis',
    },
  ];

  const active = getActiveMainItem();

  const handleClick = (label, hasSubItems, subItems, path) => {
    if (hasSubItems) {
      setOpenDropdown(label);

      if (subItems && subItems.length > 0) {
        const first = subItems[0];
        setActiveSubItem(first.label);
        navigate(first.path);
      }
    } else {
      setOpenDropdown(null);
      setActiveSubItem('');
      navigate(path);
    }
  };

  const handleSubItemClick = (subLabel) => {
    setActiveSubItem(subLabel);
  };

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        width: { xs: '220px', sm: '250px', md: '250px' },
        minWidth: '220px',
        maxWidth: '250px',
        height: '100vh',
        borderTopRightRadius: '30px',
        borderBottomRightRadius: '30px',
        boxShadow: '0px 4px 20px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <img
          src={logo}
          alt='logo'
          style={{ width: '100%', maxWidth: '150px' }}
        />
      </Box>

      <Box sx={{ flexGrow: 1, pt: 4, overflowY: 'auto' }}>
        <List disablePadding>
          {navItems.map((item) => (
            <Box key={item.label} sx={{ position: 'relative' }}>
              {active === item.label && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-20px',
                    right: 0,
                    width: '20px',
                    height: '20px',
                    overflow: 'hidden',
                    zIndex: 0,
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '20px',
                      height: '20px',
                      backgroundColor: '#fff',
                      borderBottomRightRadius: '20px',
                      boxShadow: '3px 6px 1px 5px #3e4095',
                    },
                  }}
                />
              )}

              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    ml: 2,
                    mt: 1.5,
                    py: 0.5,
                    borderRadius:
                      active === item.label ? '50px 0px 0px 50px' : '0px',
                    backgroundColor:
                      active === item.label ? '#3e4095' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    pl: 2,
                    transition: 'all 0.3s',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <ListItemButton
                    onClick={() =>
                      handleClick(
                        item.label,
                        !!item.subItems,
                        item.subItems,
                        item.path,
                      )
                    }
                    sx={{ px: 2, borderRadius: '50px 0px 0px 50px' }}
                  >
                    {item.icon && (
                      <Box
                        sx={{
                          mr: 1,
                          color: active === item.label ? 'white' : '#333',
                          minWidth: '24px',
                        }}
                      >
                        {item.icon}
                      </Box>
                    )}
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: active === item.label ? 600 : 500,
                        color: active === item.label ? 'white' : '#333',
                      }}
                    >
                      {item.label}
                    </Typography>
                  </ListItemButton>
                </Box>

                {active === item.label && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: '-20px',
                      right: 0,
                      width: '20px',
                      height: '20px',
                      overflow: 'hidden',
                      zIndex: 0,
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: '20px',
                        height: '20px',
                        backgroundColor: '#fff',
                        borderTopRightRadius: '20px',
                        boxShadow: '3px -6px 1px 5px #3e4095',
                      },
                    }}
                  />
                )}
              </Box>

              {item.subItems && (
                <Collapse
                  in={openDropdown === item.label}
                  timeout='auto'
                  unmountOnExit
                >
                  <List component='div' disablePadding>
                    {item.subItems.map((sub) => (
                      <ListItemButton
                        key={sub.label}
                        component={Link}
                        to={sub.path}
                        onClick={() => handleSubItemClick(sub.label)}
                        sx={{
                          pl: 8,
                          py: 0.5,
                          borderRadius: '0px',
                          backgroundColor: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            pt: 0.5,
                            borderBottom:
                              activeSubItem === sub.label
                                ? '2px solid #7d7fcf'
                                : '2px solid transparent',
                          }}
                        >
                          <Box
                            sx={{
                              mr: 1,
                              color:
                                activeSubItem === sub.label
                                  ? '#7d7fcf'
                                  : '#333',
                              fontSize: '10px',
                            }}
                          >
                            {sub.icon}
                          </Box>
                          <ListItemText
                            primary={sub.label}
                            primaryTypographyProps={{
                              fontSize: 14,
                              color:
                                activeSubItem === sub.label
                                  ? '#7d7fcf'
                                  : '#333',
                              fontWeight:
                                activeSubItem === sub.label ? 600 : 500,
                            }}
                          />
                        </Box>
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          ))}
        </List>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <Box
          sx={{
            p: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography sx={{ fontSize: '15px', fontWeight: 500, color: '#333' }}>
            Powered by
          </Typography>

          <img
            src={aihorizonLogo}
            alt='aihorizonLogo'
            style={{
              width: '80%',
              height: 'auto',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
